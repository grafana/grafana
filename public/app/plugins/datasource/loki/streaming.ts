import { DataQueryResponse, LiveChannelScope, LoadingState, toDataFrame } from '@grafana/data';
import { getGrafanaLiveSrv } from '@grafana/runtime';
import { map, Observable } from 'rxjs';
import LokiDatasource from './datasource';
import { LokiQuery } from './types';

// simple hash
const hashCode = (s: string) => s.split('').reduce((a, b) => ((a << 5) - a + b.charCodeAt(0)) | 0, 0);

/**
 * Calculate a unique key for the query.  The key is used to pick a channel and should
 * be unique for each distinct query execution plan.  This key is not secure and is only picked to avoid
 * possible collisions
 */
export function getLiveStreamKey(query: LokiQuery): string {
  const txt = JSON.stringify({ expr: query.expr });
  const a = Math.abs(hashCode(txt)).toString(16);
  const b = Math.abs(hashCode(a + txt)).toString(16);
  return a + b;
}

// This will get both v1 and v2 result formats
export function doLokiChannelStream(query: LokiQuery, ds: LokiDatasource): Observable<DataQueryResponse> {
  let counter = 0;
  return getGrafanaLiveSrv()
    .getStream<any>({
      scope: LiveChannelScope.DataSource,
      namespace: ds.uid,
      path: `tail/${getLiveStreamKey(query)}`,
    })
    .pipe(
      map((evt) => {
        console.log('EVENT', evt);
        return {
          data: [
            toDataFrame({
              fields: [
                { name: 'time', values: [Date.now()] },
                { name: 'vvv', values: [counter++] },
                { name: 'evt', values: [evt], config: { custom: { displayMode: 'json-view' } } },
              ],
            }),
          ],
          state: LoadingState.Streaming,
        };
      })
    );
}
