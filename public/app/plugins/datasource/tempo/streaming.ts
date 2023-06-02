import { map, Observable, defer, mergeMap } from 'rxjs';
import { v4 as uuidv4 } from 'uuid';

import {
  DataFrame,
  DataQueryRequest,
  DataQueryResponse,
  DataSourceInstanceSettings,
  LiveChannelScope,
  LoadingState,
  MutableDataFrame,
} from '@grafana/data';
import { getGrafanaLiveSrv } from '@grafana/runtime';

import { SearchStreamingState } from './dataquery.gen';
import { TempoDatasource } from './datasource';
import { createTableFrameFromTraceQlQuery } from './resultTransformer';
import { TempoJsonData, TempoQuery } from './types';
export async function getLiveStreamKey(): Promise<string> {
  return uuidv4();
}

export function doTempoChannelStream(
  query: TempoQuery,
  ds: TempoDatasource,
  options: DataQueryRequest<TempoQuery>,
  instanceSettings: DataSourceInstanceSettings<TempoJsonData>
): Observable<DataQueryResponse> {
  const range = options.range;

  let frames: DataFrame[] | undefined = undefined;
  let state: LoadingState = LoadingState.NotStarted;

  return defer(() => getLiveStreamKey()).pipe(
    mergeMap((key) => {
      return getGrafanaLiveSrv()
        .getStream<MutableDataFrame>({
          scope: LiveChannelScope.DataSource,
          namespace: ds.uid,
          path: `search/${key}`,
          data: {
            ...query,
            timeRange: {
              from: range.from.toISOString(),
              to: range.to.toISOString(),
            },
          },
        })
        .pipe(
          map((evt) => {
            if ('message' in evt && evt?.message) {
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

              frames = createTableFrameFromTraceQlQuery(traces, instanceSettings);
            }
            return {
              data: frames || [],
              state,
            };
          })
        );
    })
  );
}
