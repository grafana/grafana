import { capitalize } from 'lodash';
import { map, Observable, takeWhile } from 'rxjs';
import { v4 as uuidv4 } from 'uuid';

import {
  DataFrame,
  dataFrameFromJSON,
  DataQueryRequest,
  DataQueryResponse,
  DataSourceInstanceSettings,
  FieldType,
  LiveChannelScope,
  LoadingState,
  MutableDataFrame,
  ThresholdsConfig,
  ThresholdsMode,
} from '@grafana/data';
import { getGrafanaLiveSrv } from '@grafana/runtime';

import { SearchStreamingState } from './dataquery.gen';
import { DEFAULT_SPSS, TempoDatasource } from './datasource';
import { formatTraceQLResponse } from './resultTransformer';
import { SearchMetrics, TempoJsonData, TempoQuery } from './types';

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
          // Schema should be [traces, metrics, state, error]
          const traces = evt.message.data.values[0][0];
          const metrics = evt.message.data.values[1][0];
          const frameState: SearchStreamingState = evt.message.data.values[2][0];
          const error = evt.message.data.values[3][0];

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

  let frames: DataFrame[] = [];
  let state: LoadingState = LoadingState.NotStarted;

  return getGrafanaLiveSrv()
    .getStream<MutableDataFrame>({
      scope: LiveChannelScope.DataSource,
      namespace: ds.uid,
      path: `metrics/${getLiveStreamKey()}`,
      data: {
        ...query,
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
          // Schema should be [traces, metrics, state, error]
          const traces = evt.message.data.values[0][0];
          const frameState: SearchStreamingState = evt.message.data.values[2][0];
          const error = evt.message.data.values[3][0];

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

          mergeFrames(frames, traces?.map(dataFrameFromJSON));
        }
        return {
          data: frames,
          state,
        };
      })
    );
}

function mergeFrames(acc: DataFrame[], frames?: DataFrame[]): DataFrame[] {
  frames?.forEach((frame) => {
    const accFrame = acc.find((f) => f.name === frame.name);
    if (accFrame) {
      frame.fields.forEach((field) => {
        const accField = accFrame.fields.find((f) => f.name === field.name);
        if (accField) {
          accField.values = accField.values.concat(field.values);
        } else {
          accFrame.fields.push(field);
        }
      });
      const timeField = accFrame.fields.find((f) => f.type === FieldType.time);
      if (timeField) {
        const duplicatesMap = timeField.values.reduce((acc: Record<number, number[]>, value, index) => {
          if (acc[value]) {
            acc[value].push(index);
          } else {
            acc[value] = [index];
          }
          return acc;
        }, {});

        const indexesToRemove = Object.values(duplicatesMap)
          .filter((indexes) => indexes.length > 1)
          .map((indexes) => indexes[0]);
        accFrame.fields.forEach((field) => {
          field.values = field.values.filter((_, index) => !indexesToRemove.includes(index));
        });
      }
    } else {
      acc.push(frame);
    }
  });
  return acc;
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
