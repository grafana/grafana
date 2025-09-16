import { capitalize } from 'lodash';
import { map, Observable, scan, takeWhile } from 'rxjs';
import { v4 as uuidv4 } from 'uuid';

import {
  DataFrame,
  dataFrameFromJSON,
  DataQueryRequest,
  DataQueryResponse,
  DataSourceInstanceSettings,
  FieldCache,
  FieldType,
  LiveChannelScope,
  LoadingState,
  MutableDataFrame,
  sortDataFrame,
  ThresholdsConfig,
  ThresholdsMode,
} from '@grafana/data';
import { cloneQueryResponse, combineResponses } from '@grafana/o11y-ds-frontend';
import { getGrafanaLiveSrv } from '@grafana/runtime';

import { MetricsQueryType, SearchStreamingState } from './dataquery.gen';
import { DEFAULT_SPSS, TempoDatasource } from './datasource';
import { formatTraceQLResponse } from './resultTransformer';
import { SearchMetrics, TempoJsonData, TempoQuery } from './types';
import { stepToNanos } from './utils';

function getLiveStreamKey(): string {
  return uuidv4();
}

export function doTempoSearchStreaming(
  query: TempoQuery,
  ds: TempoDatasource,
  options: DataQueryRequest<TempoQuery>,
  instanceSettings: DataSourceInstanceSettings<TempoJsonData>
): Observable<DataQueryResponse> {
  const range = options.range;

  let frames: DataFrame[] | undefined = undefined;
  let state: LoadingState = LoadingState.NotStarted;
  const requestTime = performance.now();

  return getGrafanaLiveSrv()
    .getStream<MutableDataFrame>({
      scope: LiveChannelScope.DataSource,
      namespace: ds.uid,
      path: `search/${getLiveStreamKey()}`,
      data: {
        ...query,
        SpansPerSpanSet: query.spss ?? DEFAULT_SPSS,
        timeRange: {
          from: range.from.toISOString(),
          to: range.to.toISOString(),
        },
      },
    })
    .pipe(
      takeWhile((evt) => {
        if ('message' in evt && evt?.message) {
          const frameState: SearchStreamingState = evt.message.data.values[2][0];
          if (frameState === SearchStreamingState.Done || frameState === SearchStreamingState.Error) {
            return false;
          }
        }
        return true;
      }, true)
    )
    .pipe(
      map((evt) => {
        if ('message' in evt && evt?.message) {
          const currentTime = performance.now();
          const elapsedTime = currentTime - requestTime;

          const messageFrame = dataFrameFromJSON(evt.message);
          const fieldCache = new FieldCache(messageFrame);

          const traces = fieldCache.getFieldByName('result')?.values[0];
          const metrics = fieldCache.getFieldByName('metrics')?.values[0];
          const frameState = fieldCache.getFieldByName('state')?.values[0];
          const error = fieldCache.getFieldByName('error')?.values[0];

          switch (frameState) {
            case SearchStreamingState.Done:
              state = LoadingState.Done;
              break;
            case SearchStreamingState.Streaming:
              state = LoadingState.Streaming;
              break;
            case SearchStreamingState.Error:
              throw new Error(error);
          }

          // The order of the frames is important. The metrics frame should always be the last frame.
          // This is because the metrics frame is used to display the progress of the streaming query
          // and we would like to display the results first.
          frames = [
            ...formatTraceQLResponse(traces, instanceSettings, query.tableType),
            metricsDataFrame(metrics, frameState, elapsedTime),
          ];
        }
        return {
          data: frames || [],
          state,
        };
      })
    );
}

export function doTempoMetricsStreaming(
  query: TempoQuery,
  ds: TempoDatasource,
  options: DataQueryRequest<TempoQuery>
): Observable<DataQueryResponse> {
  const range = options.range;
  const key = getLiveStreamKey();

  let state: LoadingState = LoadingState.NotStarted;
  const step = stepToNanos(query.step);

  return getGrafanaLiveSrv()
    .getStream<MutableDataFrame>({
      scope: LiveChannelScope.DataSource,
      namespace: ds.uid,
      path: `metrics/${key}`,
      data: {
        ...query,
        step,
        timeRange: {
          from: range.from.toISOString(),
          to: range.to.toISOString(),
        },
      },
    })
    .pipe(
      takeWhile((evt) => {
        if ('message' in evt && evt?.message) {
          const frameState: SearchStreamingState = evt.message.data.values[2][0];
          if (frameState === SearchStreamingState.Done || frameState === SearchStreamingState.Error) {
            return false;
          }
        }
        return true;
      }, true),
      map((evt) => {
        let newResult: DataQueryResponse = { data: [], state: LoadingState.NotStarted };
        if ('message' in evt && evt?.message) {
          const messageFrame = dataFrameFromJSON(evt.message);
          const fieldCache = new FieldCache(messageFrame);

          const data = fieldCache.getFieldByName('result')?.values[0];
          const frameState = fieldCache.getFieldByName('state')?.values[0];
          const error = fieldCache.getFieldByName('error')?.values[0];

          switch (frameState) {
            case SearchStreamingState.Done:
              state = LoadingState.Done;
              break;
            case SearchStreamingState.Streaming:
              state = LoadingState.Streaming;
              break;
            case SearchStreamingState.Error:
              throw new Error(error);
          }

          newResult = {
            data: data?.map(dataFrameFromJSON) ?? [],
            state,
          };
        }

        return newResult;
      }),
      // Merge results on acc
      scan((acc, curr) => {
        if (!curr) {
          return acc;
        }
        // If the query is an instant query, we always want the latest result.
        if (!acc || query.metricsQueryType === MetricsQueryType.Instant) {
          return cloneQueryResponse(curr);
        }
        return mergeFrames(acc, curr);
      })
    );
}

function mergeFrames(acc: DataQueryResponse, newResult: DataQueryResponse): DataQueryResponse {
  const result = combineResponses(cloneQueryResponse(acc), newResult);

  result.data = result.data.map((frame: DataFrame) => {
    let newFrame = frame;
    const timeFieldIndex = frame.fields.findIndex((f) => f.type === FieldType.time);
    if (timeFieldIndex >= 0) {
      removeDuplicateTimeFieldValues(frame, timeFieldIndex);
      newFrame = sortDataFrame(frame, timeFieldIndex);
    }
    return newFrame;
  });

  result.state = newResult.state;
  return result;
}

/**
 * Remove duplicate time field values from the DataFrame. This is necessary because Tempo sends partial results to Grafana
 * that we append to an existing DataFrame. This can result in duplicate values for the same timestamp so this function removes
 * older values and keeps the latest value.
 * @param accFrame
 * @param timeFieldIndex
 */
function removeDuplicateTimeFieldValues(accFrame: DataFrame, timeFieldIndex: number) {
  const duplicatesMap = accFrame.fields[timeFieldIndex].values.reduce((acc: Record<number, number[]>, value, index) => {
    if (acc[value]) {
      acc[value].push(index);
    } else {
      acc[value] = [index];
    }
    return acc;
  }, {});

  const indexesToRemove = Object.values(duplicatesMap)
    .filter((indexes) => indexes.length > 1)
    .map((indexes) => indexes.slice(1))
    .flat();
  accFrame.fields.forEach((field) => {
    field.values = field.values.filter((_, index) => !indexesToRemove.includes(index));
  });

  // This updates the length of the dataframe having already removed duplicate values.
  // This is necessary because Tempo sends partial results to Grafana and
  // this can result in duplicate values for the same timestamp so this removes
  // older values and keeps the latest value, and ensures the length of the dataframe is updated,
  // which would otherwise cause issues with rendering the exemplar data.
  if (accFrame.name === 'exemplar' && accFrame.meta?.dataTopic === 'annotations' && indexesToRemove.length > 0) {
    accFrame.length = accFrame.fields[timeFieldIndex].values.length;
  }
}

function metricsDataFrame(metrics: SearchMetrics, state: SearchStreamingState, elapsedTime: number) {
  const progressThresholds: ThresholdsConfig = {
    steps: [
      {
        color: 'blue',
        value: -Infinity,
      },
      {
        color: 'green',
        value: 75,
      },
    ],
    mode: ThresholdsMode.Absolute,
  };

  const frame: DataFrame = {
    refId: 'streaming-progress',
    name: 'Streaming Progress',
    length: 1,
    fields: [
      {
        name: 'state',
        type: FieldType.string,
        values: [capitalize(state.toString())],
        config: {
          displayNameFromDS: 'State',
        },
      },
      {
        name: 'elapsedTime',
        type: FieldType.number,
        values: [elapsedTime],
        config: {
          unit: 'ms',
          displayNameFromDS: 'Elapsed Time',
        },
      },
      {
        name: 'totalBlocks',
        type: FieldType.number,
        values: [metrics.totalBlocks],
        config: {
          displayNameFromDS: 'Total Blocks',
        },
      },
      {
        name: 'completedJobs',
        type: FieldType.number,
        values: [metrics.completedJobs],
        config: {
          displayNameFromDS: 'Completed Jobs',
        },
      },
      {
        name: 'totalJobs',
        type: FieldType.number,
        values: [metrics.totalJobs],
        config: {
          displayNameFromDS: 'Total Jobs',
        },
      },
      {
        name: 'progress',
        type: FieldType.number,
        values: [
          state === SearchStreamingState.Done ? 100 : ((metrics.completedJobs || 0) / (metrics.totalJobs || 1)) * 100,
        ],
        config: {
          displayNameFromDS: 'Progress',
          unit: 'percent',
          min: 0,
          max: 100,
          custom: {
            cellOptions: {
              type: 'gauge',
              mode: 'gradient',
            },
          },
          thresholds: progressThresholds,
        },
      },
    ],
    meta: {
      preferredVisualisationType: 'table',
    },
  };
  return frame;
}
