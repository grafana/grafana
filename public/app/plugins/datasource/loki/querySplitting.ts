import { groupBy, partition } from 'lodash';
import { Observable, Subscriber, Subscription, tap } from 'rxjs';
import { v4 as uuidv4 } from 'uuid';

import {
  arrayToDataFrame,
  DataQueryRequest,
  DataQueryResponse,
  DataTopic,
  dateTime,
  durationToMilliseconds,
  parseDuration,
  rangeUtil,
  TimeRange,
} from '@grafana/data';
import { LoadingState } from '@grafana/schema';

import { LokiDatasource } from './datasource';
import { splitTimeRange as splitLogsTimeRange } from './logsTimeSplitting';
import { splitTimeRange as splitMetricTimeRange } from './metricTimeSplitting';
import { isLogsQuery, isQueryWithDistinct, isQueryWithRangeVariable } from './queryUtils';
import { combineResponses } from './responseUtils';
import { trackGroupedQueries } from './tracking';
import { LokiGroupedRequest, LokiQuery, LokiQueryType } from './types';

export function partitionTimeRange(
  isLogsQuery: boolean,
  originalTimeRange: TimeRange,
  stepMs: number,
  duration: number
): TimeRange[] {
  const start = originalTimeRange.from.toDate().getTime();
  const end = originalTimeRange.to.toDate().getTime();

  const ranges = isLogsQuery
    ? splitLogsTimeRange(start, end, duration)
    : splitMetricTimeRange(start, end, stepMs, duration);

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
export function runSplitGroupedQueries(datasource: LokiDatasource, requests: LokiGroupedRequest[]) {
  let mergedResponse: DataQueryResponse = { data: [], state: LoadingState.Streaming };
  const totalRequests = Math.max(...requests.map(({ partition }) => partition.length));
  const longestPartition = requests.filter(({ partition }) => partition.length === totalRequests)[0].partition;

  let shouldStop = false;
  let subquerySubsciption: Subscription | null = null;
  const runNextRequest = (subscriber: Subscriber<DataQueryResponse>, requestN: number, requestGroup: number) => {
    if (shouldStop) {
      subscriber.complete();
      return;
    }

    const done = () => {
      mergedResponse.state = LoadingState.Done;
      subscriber.next(mergedResponse);
      subscriber.complete();
    };

    const nextRequest = () => {
      const { nextRequestN, nextRequestGroup } = getNextRequestPointers(requests, requestGroup, requestN);
      if (nextRequestN > 0 && nextRequestGroup >= 0) {
        runNextRequest(subscriber, nextRequestN, nextRequestGroup);
        return;
      }
      done();
    };

    const group = requests[requestGroup];
    const range = group.partition[requestN - 1];
    const targets = adjustTargetsFromResponseState(group.request.targets, mergedResponse);

    if (!targets.length) {
      nextRequest();
      return;
    }

    const subRequest = { ...requests[requestGroup].request, range, targets };
    // request may not have a request id
    if (group.request.requestId) {
      subRequest.requestId = `${group.request.requestId}_${requestN}`;
    }

    subquerySubsciption = datasource.runQuery(subRequest).subscribe({
      next: (partialResponse) => {
        mergedResponse = combineResponses(mergedResponse, partialResponse);
        mergedResponse = updateLoadingFrame(mergedResponse, subRequest, longestPartition, requestN);
        if ((mergedResponse.errors ?? []).length > 0 || mergedResponse.error != null) {
          shouldStop = true;
        }
      },
      complete: () => {
        subscriber.next(mergedResponse);
        nextRequest();
      },
      error: (error) => {
        subscriber.error(error);
      },
    });
  };

  const response = new Observable<DataQueryResponse>((subscriber) => {
    runNextRequest(subscriber, totalRequests, 0);
    return () => {
      shouldStop = true;
      if (subquerySubsciption != null) {
        subquerySubsciption.unsubscribe();
      }
    };
  });

  return response;
}

function updateLoadingFrame(
  response: DataQueryResponse,
  request: DataQueryRequest<LokiQuery>,
  partition: TimeRange[],
  requestN: number
): DataQueryResponse {
  if (isLogsQuery(request.targets[0].expr) || isLogsVolumeRequest(request)) {
    return response;
  }
  const loadingFrameName = 'loki-splitting-progress';
  response.data = response.data.filter((frame) => frame.name !== loadingFrameName);

  if (requestN <= 1) {
    return response;
  }

  const loadingFrame = arrayToDataFrame([
    {
      time: partition[0].from.valueOf(),
      timeEnd: partition[requestN - 2].to.valueOf(),
      isRegion: true,
      color: 'rgba(120, 120, 120, 0.1)',
    },
  ]);
  loadingFrame.name = loadingFrameName;
  loadingFrame.meta = {
    dataTopic: DataTopic.Annotations,
  };

  response.data.push(loadingFrame);

  return response;
}

function isLogsVolumeRequest(request: DataQueryRequest<LokiQuery>): boolean {
  return request.targets.some((target) => target.refId.startsWith('log-volume'));
}

function getNextRequestPointers(requests: LokiGroupedRequest[], requestGroup: number, requestN: number) {
  // There's a pending request from the next group:
  for (let i = requestGroup + 1; i < requests.length; i++) {
    const group = requests[i];
    if (group.partition[requestN - 1]) {
      return {
        nextRequestGroup: i,
        nextRequestN: requestN,
      };
    }
  }
  return {
    // Find the first group where `[requestN - 1]` is defined
    nextRequestGroup: requests.findIndex((group) => group?.partition[requestN - 1] !== undefined),
    nextRequestN: requestN - 1,
  };
}

function querySupportsSplitting(query: LokiQuery) {
  return (
    query.queryType !== LokiQueryType.Instant &&
    !isQueryWithDistinct(query.expr) &&
    // Queries with $__range variable should not be split because then the interpolated $__range variable is incorrect
    // because it is interpolated on the backend with the split timeRange
    !isQueryWithRangeVariable(query.expr)
  );
}

export function runSplitQuery(datasource: LokiDatasource, request: DataQueryRequest<LokiQuery>) {
  const queries = request.targets.filter((query) => !query.hide);
  const [nonSplittingQueries, normalQueries] = partition(queries, (query) => !querySupportsSplitting(query));
  const [logQueries, metricQueries] = partition(normalQueries, (query) => isLogsQuery(query.expr));

  request.queryGroupId = uuidv4();
  const oneDayMs = 24 * 60 * 60 * 1000;
  const rangePartitionedLogQueries = groupBy(logQueries, (query) =>
    query.splitDuration ? durationToMilliseconds(parseDuration(query.splitDuration)) : oneDayMs
  );
  const rangePartitionedMetricQueries = groupBy(metricQueries, (query) =>
    query.splitDuration ? durationToMilliseconds(parseDuration(query.splitDuration)) : oneDayMs
  );

  const requests: LokiGroupedRequest[] = [];
  for (const [chunkRangeMs, queries] of Object.entries(rangePartitionedLogQueries)) {
    const resolutionPartition = groupBy(queries, (query) => query.resolution || 1);
    for (const resolution in resolutionPartition) {
      requests.push({
        request: { ...request, targets: resolutionPartition[resolution] },
        partition: partitionTimeRange(true, request.range, request.intervalMs, Number(chunkRangeMs)),
      });
    }
  }

  for (const [chunkRangeMs, queries] of Object.entries(rangePartitionedMetricQueries)) {
    const stepMsPartition = groupBy(queries, (query) =>
      calculateStep(request.intervalMs, request.range, query.resolution || 1, query.step)
    );

    for (const stepMs in stepMsPartition) {
      requests.push({
        request: { ...request, targets: stepMsPartition[stepMs] },
        partition: partitionTimeRange(false, request.range, Number(stepMs), Number(chunkRangeMs)),
      });
    }
  }

  if (nonSplittingQueries.length) {
    requests.push({
      request: { ...request, targets: nonSplittingQueries },
      partition: [request.range],
    });
  }

  const startTime = new Date();
  return runSplitGroupedQueries(datasource, requests).pipe(
    tap((response) => {
      if (response.state === LoadingState.Done) {
        trackGroupedQueries(response, requests, request, startTime, {
          predefinedOperations: datasource.predefinedOperations,
        });
      }
    })
  );
}

// Replicate from backend for split queries for now, until we can move query splitting to the backend
// https://github.com/grafana/grafana/blob/main/pkg/tsdb/loki/step.go#L23
function calculateStep(intervalMs: number, range: TimeRange, resolution: number, step: string | undefined) {
  // If we can parse step,the we use it
  // Otherwise we will calculate step based on interval
  const interval_regex = /(-?\d+(?:\.\d+)?)(ms|[Mwdhmsy])/;
  if (step?.match(interval_regex)) {
    return rangeUtil.intervalToMs(step) * resolution;
  }

  const newStep = intervalMs * resolution;
  const safeStep = Math.round((range.to.valueOf() - range.from.valueOf()) / 11000);
  return Math.max(newStep, safeStep);
}
