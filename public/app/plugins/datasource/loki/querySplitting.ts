import { partition } from 'lodash';
import { Subscriber, Observable, Subscription } from 'rxjs';

import { DataFrame, DataFrameType, DataQueryRequest, DataQueryResponse, dateTime, TimeRange } from '@grafana/data';
import { LoadingState } from '@grafana/schema';

import { LokiDatasource } from './datasource';
import { getRangeChunks as getLogsRangeChunks } from './logsTimeSplit';
import { getRangeChunks as getMetricRangeChunks } from './metricTimeSplit';
import { combineLogsResponses, combineMetricsResponses, isLogsQuery } from './queryUtils';
import { LokiQuery } from './types';

/**
 * Purposely exposing it to support doing tests without needing to update the repo.
 * TODO: remove.
 * Hardcoded to 1 day.
 */
(window as any).lokiChunkDuration = 24 * 60 * 60 * 1000;

function calculateStep(start: number, end: number, intervalMs: number, resolutions: Array<number | undefined>): number {
  const safeStep = Math.ceil((end - start) / 11000);
  // FIXME: for now we just take the first resolution.
  // we should calculate a "shared" resolution coefficient,
  // it will be the lowest-common-multiple of the resolutions
  const resolution = resolutions[0] ?? 1;
  return Math.max(intervalMs * resolution, safeStep);
}

type Task = {
  range: TimeRange;
  queries: LokiQuery[];
};

function chunkToRange(start: number, end: number): TimeRange {
  const from = dateTime(start);
  const to = dateTime(end);
  return {
    from,
    to,
    raw: { from, to },
  };
}

function createTasks(
  queries: LokiQuery[],
  originalTimeRange: TimeRange,
  intervalMs: number,
  durationMs: number
): Task[] {
  const start = originalTimeRange.from.toDate().getTime();
  const end = originalTimeRange.to.toDate().getTime();

  const [logsQueries, metricsQueries] = partition(queries, (q) => isLogsQuery(q.expr));

  let logsTasks: Task[] = [];
  let metricsTasks: Task[] = [];

  if (logsQueries.length > 0) {
    const chunks = getLogsRangeChunks(start, end, durationMs);
    // if not possible to chunk, use the original range
    const ranges = chunks != null ? chunks.map((c) => chunkToRange(c[0], c[1])) : [originalTimeRange];
    logsTasks = ranges.map((range) => ({
      type: 'logs',
      range,
      queries: logsQueries,
    }));
  }

  if (metricsQueries.length > 0) {
    const step = calculateStep(
      start,
      end,
      intervalMs,
      metricsQueries.map((q) => q.resolution)
    );
    const chunks = getMetricRangeChunks(start, end, step, durationMs);
    // if not possible to chunk, use the original range
    const ranges = chunks != null ? chunks.map((c) => chunkToRange(c[0], c[1])) : [originalTimeRange];
    metricsTasks = ranges.map((range) => ({
      type: 'metrics',
      range,
      queries: metricsQueries,
    }));
  }

  // we need to join the two tasks-lists, but we should alternatve between the task-types
  const maxLen = Math.max(metricsTasks.length, logsTasks.length);
  const tasks: Task[] = [];

  for (let i = 0; i < maxLen; i++) {
    const logsTask = logsTasks[i];
    if (logsTask != null) {
      tasks.push(logsTask);
    }
    const metricsTask = metricsTasks[i];
    if (metricsTask != null) {
      tasks.push(metricsTask);
    }
  }

  return tasks;
}

/**
 * Based in the state of the current response, if any, adjust target parameters such as `maxLines`.
 * For `maxLines`, we will update it as `maxLines - current amount of lines`.
 * At the end, we will filter the targets that don't need to be executed in the next request batch,
 * becasue, for example, the `maxLines` have been reached.
 */

function adjustTargetsFromResponseState(targets: LokiQuery[], state: State): LokiQuery[] {
  return targets
    .map((target) => {
      if (!target.maxLines || !isLogsQuery(target.expr)) {
        return target;
      }
      const targetFrame = state.logsFrames.get(target.refId);
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

type State = {
  metricsFrames: Map<string, DataFrame[]>;
  logsFrames: Map<string, DataFrame>;
};

function updateState(state: State, newFrames: DataFrame[]): void {
  const newLogsFrames: DataFrame[] = [];
  const newMetricsFrames: DataFrame[] = [];

  // we categorize the new frames
  newFrames.forEach((frame) => {
    if (frame.meta?.custom?.frameType === 'LabeledTimeValues') {
      newLogsFrames.push(frame);
    } else {
      if (frame.meta?.type === DataFrameType.TimeSeriesMulti) {
        newMetricsFrames.push(frame);
      } else {
        throw new Error('unknown dataframe');
      }
    }
  });

  combineLogsResponses(state.logsFrames, newLogsFrames);
  combineMetricsResponses(state.metricsFrames, newMetricsFrames);
}

function stateToFrames(state: State): DataFrame[] {
  const metricsFrames = Array.from(state.metricsFrames.values()).flat();
  const logsFrames = state.logsFrames.values();
  return [...metricsFrames, ...logsFrames];
}

function makeEmptyState(): State {
  return { metricsFrames: new Map(), logsFrames: new Map() };
}

export function runPartitionedQuery(datasource: LokiDatasource, request: DataQueryRequest<LokiQuery>) {
  const state = makeEmptyState();
  const queries = request.targets.filter((query) => !query.hide);

  const tasks = createTasks(queries, request.range, request.intervalMs, (window as any).lokiChunkDuration);
  const totalRequests = tasks.length;

  let shouldStop = false;
  let subquerySubsciption: Subscription | null = null;
  const runNextRequest = (subscriber: Subscriber<DataQueryResponse>, requestN: number) => {
    if (shouldStop) {
      subscriber.complete();
      return;
    }

    const done = () => {
      subscriber.next({
        data: stateToFrames(state),
        state: LoadingState.Done,
      });
      subscriber.complete();
    };

    const requestId = `${request.requestId}_${requestN}`;
    const task = tasks[requestN - 1];
    const targets = adjustTargetsFromResponseState(task.queries, state);

    const nextRequest = () => {
      if (requestN > 1) {
        subscriber.next({
          data: stateToFrames(state),
          state: LoadingState.Streaming,
        });
        runNextRequest(subscriber, requestN - 1);
        return;
      }
      done();
    };

    // NOTE: we could in theory skip running requests with zero queries,
    // but that would complicate the logic, and grafana will skip
    // such requests anyway.

    subquerySubsciption = datasource.runQuery({ ...request, range: task.range, requestId, targets }).subscribe({
      next: (partialResponse) => {
        if (partialResponse.error) {
          subscriber.error(partialResponse.error);
        }
        updateState(state, partialResponse.data);
      },
      complete: () => {
        nextRequest();
      },
      error: (error) => {
        subscriber.error(error);
      },
    });
  };

  const response = new Observable<DataQueryResponse>((subscriber) => {
    runNextRequest(subscriber, totalRequests);
    return () => {
      shouldStop = true;
      if (subquerySubsciption != null) {
        subquerySubsciption.unsubscribe();
      }
    };
  });

  return response;
}
