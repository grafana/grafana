import { Subscriber, map, Observable } from 'rxjs';

import { DataQueryRequest, DataQueryResponse, dateTime, TimeRange } from '@grafana/data';
import { LoadingState } from '@grafana/schema';

import { LokiDatasource } from './datasource';
import { getRangeChunks as getLogsRangeChunks } from './logsTimeSplit';
import { getRangeChunks as getMetricRangeChunks } from './metricTimeSplit';
import { combineResponses, isLogsQuery, resultLimitReached } from './queryUtils';
import { LokiQuery } from './types';

/**
 * Purposely exposing it to support doing tests without needing to update the repo.
 * TODO: remove.
 * Hardcoded to 1 day.
 */
(window as any).lokiChunkDuration = 24 * 60 * 60 * 1000;

export function partitionTimeRange(
  isLogsQuery: boolean,
  originalTimeRange: TimeRange,
  intervalMs: number,
  resolution: number
): TimeRange[] {
  // the `step` value that will be finally sent to Loki is rougly the same as `intervalMs`,
  // but there are some complications.
  // we need to replicate this algo:
  //
  // https://github.com/grafana/grafana/blob/main/pkg/tsdb/loki/step.go#L23

  const start = originalTimeRange.from.toDate().getTime();
  const end = originalTimeRange.to.toDate().getTime();

  const safeStep = Math.ceil((end - start) / 11000);
  const step = Math.max(intervalMs * resolution, safeStep);

  const duration: number = (window as any).lokiChunkDuration;

  const ranges = isLogsQuery
    ? getLogsRangeChunks(start, end, duration)
    : getMetricRangeChunks(start, end, step, duration);

  // if the split was not possible, go with the original range
  if (ranges == null) {
    return [originalTimeRange];
  }

  return ranges.map(([start, end]) => {
    const from = dateTime(start);
    const to = dateTime(end);
    return {
      from,
      to,
      raw: { from, to },
    };
  });
}

export function runPartitionedQuery(datasource: LokiDatasource, request: DataQueryRequest<LokiQuery>) {
  let mergedResponse: DataQueryResponse | null;
  // we assume there is just a single query in the request
  const query = request.targets[0];
  const partition = partitionTimeRange(
    isLogsQuery(query.expr),
    request.range,
    request.intervalMs,
    query.resolution ?? 1
  );
  const totalRequests = partition.length;

  const runNextRequest = (subscriber: Subscriber<DataQueryResponse>, requestN: number) => {
    const requestId = `${request.requestId}_${requestN}`;
    const range = partition[requestN - 1];
    datasource
      .runQuery({ ...request, range, requestId })
      .pipe(
        // in case of an empty query, this is somehow run twice. `share()` is no workaround here as the observable is generated from `of()`.
        map((partialResponse) => {
          mergedResponse = combineResponses(mergedResponse, partialResponse);
          return mergedResponse;
        })
      )
      .subscribe({
        next: (response) => {
          if (requestN > 1 && resultLimitReached(request, response) === false) {
            response.state = LoadingState.Streaming;
            subscriber.next(response);
            runNextRequest(subscriber, requestN - 1);
            return;
          }
          response.state = LoadingState.Done;
          subscriber.next(response);
          subscriber.complete();
        },
        error: (error) => {
          subscriber.error(error);
        },
      });
  };

  const response = new Observable<DataQueryResponse>((subscriber) => {
    runNextRequest(subscriber, totalRequests);
  });

  return response;
}
