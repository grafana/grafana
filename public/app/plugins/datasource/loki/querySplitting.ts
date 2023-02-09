import { Subscriber, map, Observable } from 'rxjs';

import { DataQueryRequest, DataQueryResponse, dateTime, TimeRange } from '@grafana/data';
import { LoadingState } from '@grafana/schema';

import { LokiDatasource } from './datasource';
import { getRanges } from './metricTimeSplit';
import { combineResponses, resultLimitReached } from './queryUtils';
import { LokiQuery } from './types';

/**
 * Purposely exposing it to support doing tests without needing to update the repo.
 * TODO: remove.
 * Hardcoded to 1 day.
 */
(window as any).lokiChunkDuration = 24 * 60 * 60 * 1000;

export function partitionTimeRange(originalTimeRange: TimeRange, intervalMs: number, resolution: number): TimeRange[] {
  // we currently assume we are only running metric queries here.
  // for logs-queries we will have to use a different time-range-split algorithm.

  // the `step` value that will be finally sent to Loki is rougly the same as `intervalMs`,
  // but there are some complications.
  // we need to replicate this algo:
  //
  // https://github.com/grafana/grafana/blob/main/pkg/tsdb/loki/step.go#L23

  const start = originalTimeRange.from.toDate().getTime();
  const end = originalTimeRange.to.toDate().getTime();

  const safeStep = Math.ceil((end - start) / 11000);
  const step = Math.max(intervalMs * resolution, safeStep);

  const ranges = getRanges(start, end, step, (window as any).lokiChunkDuration);

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
  // FIXME: the following line assumes every query has the same resolution
  const partition = partitionTimeRange(request.range, request.intervalMs, request.targets[0].resolution ?? 1);
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
