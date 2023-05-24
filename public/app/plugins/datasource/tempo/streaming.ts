import { map, Observable, defer, mergeMap, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
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

import { TempoDatasource } from './datasource';
import { createTableFrameFromTraceQlQuery } from './resultTransformer';
import { TempoJsonData, TempoQuery } from './types';
export async function getLiveStreamKey(query: TempoQuery): Promise<string> {
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

  return defer(() => getLiveStreamKey(query)).pipe(
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
            console.log(evt);
            if ('message' in evt && evt?.message) {
              const traces = evt.message.data.values[0][0];
              state = evt.message.data.values[2][0] === 2 ? LoadingState.Done : LoadingState.Loading;
              frames = createTableFrameFromTraceQlQuery(traces, instanceSettings);
            }
            return {
              data: frames || [],
              state,
            };
          }),
          catchError((err) => {
            console.log(err);
            return of({
              data: [],
              state: LoadingState.Error,
            });
          })
        );
    })
  );
}
