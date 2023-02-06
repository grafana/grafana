import { Subscriber, map, Observable } from 'rxjs';

import { DataQueryRequest, DataQueryResponse, dateTime, TimeRange } from '@grafana/data';
import { LoadingState } from '@grafana/schema';

import { LokiDatasource } from './datasource';
import { getRanges } from './metricTimeSplit';
import { combineResponses, resultLimitReached } from './queryUtils';
import { LokiQuery } from './types';

function partitionTimeRange(originalTimeRange: TimeRange, intervalMs: number): TimeRange[] {
  // we currently assume we are only running metric queries here.
  // for logs-queries we will have to use a different time-range-split algorithm.
  const ranges = getRanges(
    originalTimeRange.from.toDate().getTime(),
    originalTimeRange.to.toDate().getTime(),
    intervalMs,
    60 * 1000 // we go with a hardcoded 1minute for now
  );

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
  const partition = partitionTimeRange(request.range, request.intervalMs);
  const totalRequests = partition.length;

  const next = (subscriber: Subscriber<DataQueryResponse>, requestN: number) => {
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
            next(subscriber, requestN - 1);
          } else {
            response.state = LoadingState.Done;
          }

          subscriber.next(response);
        },
        error: (error) => {
          subscriber.error(error);
        },
      });
  };

  const response = new Observable<DataQueryResponse>((subscriber) => {
    next(subscriber, totalRequests);
  });

  return response;
}
