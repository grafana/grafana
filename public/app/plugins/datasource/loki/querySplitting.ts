import { Observable, Subscription } from 'rxjs';

import { DataQueryRequest, DataQueryResponse, dateTime, TimeRange } from '@grafana/data';
import { LoadingState } from '@grafana/schema';

import { LokiDatasource } from './datasource';
import { getRangeChunks as getLogsRangeChunks } from './logsTimeSplit';
import { getRangeChunks as getMetricRangeChunks } from './metricTimeSplit';
import { combineResponses, isLogsQuery } from './queryUtils';
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

/**
 * Based in the state of the current response, if any, adjust target parameters such as `maxLines`.
 * For `maxLines`, we will update it as `maxLines - current amount of lines`.
 * At the end, we will filter the targets that don't need to be executed in the next request batch,
 * becasue, for example, the `maxLines` have been reached.
 */

function adjustTargetsFromResponseState(targets: LokiQuery[], response: DataQueryResponse | null): LokiQuery[] {
  if (!response) {
    return targets;
  }

  return targets
    .map((target) => {
      if (!target.maxLines || !isLogsQuery(target.expr)) {
        return target;
      }
      const targetFrame = response.data.find((frame) => frame.refId === target.refId);
      if (!targetFrame) {
        return target;
      }
      const updatedMaxLines = target.maxLines - targetFrame.length;
      return {
        ...target,
        maxLines: updatedMaxLines < 0 ? 0 : updatedMaxLines,
      };
    })
    .filter((target) => target.maxLines === undefined || target.maxLines > 0);
}

export function runPartitionedQuery(datasource: LokiDatasource, request: DataQueryRequest<LokiQuery>) {
  let mergedResponse: DataQueryResponse = {
    state: LoadingState.Streaming,
    data: [],
  };

  const queries = request.targets.filter((query) => !query.hide);
  // we assume there is just a single query in the request
  const query = queries[0];
  const partition = partitionTimeRange(
    isLogsQuery(query.expr),
    request.range,
    request.intervalMs,
    query.resolution ?? 1
  );
  const totalRequests = partition.length;

  return new Observable<DataQueryResponse>((subscriber) => {
    let shouldStop = false;
    let smallQuerySubsciption: Subscription | null = null;

    const update = () => {
      subscriber.next(mergedResponse);
    };

    const done = () => {
      mergedResponse.state = LoadingState.Done;
      subscriber.next(mergedResponse);
      subscriber.complete();
    };

    const stop = () => {
      shouldStop = true;
      if (smallQuerySubsciption != null) {
        smallQuerySubsciption.unsubscribe();
      }
    };

    const runNextRequest = (requestN: number) => {
      if (shouldStop) {
        return;
      }

      const requestId = `${request.requestId}_${requestN}`;
      const range = partition[requestN - 1];
      const targets = adjustTargetsFromResponseState(request.targets, mergedResponse);

      if (!targets.length) {
        done();
        return;
      }

      smallQuerySubsciption = datasource.runQuery({ ...request, range, requestId, targets }).subscribe({
        next: (response) => {
          const { error } = response;
          if (error != null) {
            mergedResponse.state = LoadingState.Error;
            mergedResponse.error = error;
            update();
            subscriber.complete();
            stop(); // if an error happened, we stop any further processing
          } else {
            mergedResponse = combineResponses(mergedResponse, response);
            update();
          }
        },
        complete: () => {
          if (requestN > 1) {
            runNextRequest(requestN - 1);
            return;
          }
          done();
        },
        error: (error) => {
          subscriber.error(error);
        },
      });
    };

    runNextRequest(totalRequests);
    return () => {
      stop();
    };
  });
}
