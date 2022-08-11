import { map, Observable, defer, mergeMap } from 'rxjs';

import { DataFrameJSON, DataQueryRequest, DataQueryResponse, LiveChannelScope, LoadingState } from '@grafana/data';
import { getGrafanaLiveSrv } from '@grafana/runtime';
import { StreamingDataFrame } from 'app/features/live/data/StreamingDataFrame';

import { LokiDatasource } from './datasource';
import { LokiQuery } from './types';

/**
 * Calculate a unique key for the query.  The key is used to pick a channel and should
 * be unique for each distinct query execution plan.  This key is not secure and is only picked to avoid
 * possible collisions
 */
export async function getLiveStreamKey(query: LokiQuery): Promise<string> {
  const str = JSON.stringify({ expr: query.expr });

  const msgUint8 = new TextEncoder().encode(str); // encode as (utf-8) Uint8Array
  const hashBuffer = await crypto.subtle.digest('SHA-1', msgUint8); // hash the message
  const hashArray = Array.from(new Uint8Array(hashBuffer.slice(0, 8))); // first 8 bytes
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

// This will get both v1 and v2 result formats
export function doLokiChannelStream(
  query: LokiQuery,
  ds: LokiDatasource,
  options: DataQueryRequest<LokiQuery>
): Observable<DataQueryResponse> {
  // maximum time to keep values
  const range = options.range;
  const maxDelta = range.to.valueOf() - range.from.valueOf() + 1000;
  let maxLength = options.maxDataPoints ?? 1000;
  if (maxLength > 100) {
    // for small buffers, keep them small
    maxLength *= 2;
  }

  let frame: StreamingDataFrame | undefined = undefined;
  const updateFrame = (msg: any) => {
    if (msg?.message) {
      const p = msg.message as DataFrameJSON;
      if (!frame) {
        frame = StreamingDataFrame.fromDataFrameJSON(p, {
          maxLength,
          maxDelta,
          displayNameFormat: query.legendFormat,
        });
      } else {
        frame.push(p);
      }
    }
    return frame;
  };

  return defer(() => getLiveStreamKey(query)).pipe(
    mergeMap((key) => {
      return getGrafanaLiveSrv()
        .getStream<any>({
          scope: LiveChannelScope.DataSource,
          namespace: ds.uid,
          path: `tail/${key}`,
          data: {
            ...query,
            timeRange: {
              from: range.from.valueOf().toString(),
              to: range.to.valueOf().toString(),
            },
          },
        })
        .pipe(
          map((evt) => {
            const frame = updateFrame(evt);
            return {
              data: frame ? [frame] : [],
              state: LoadingState.Streaming,
            };
          })
        );
    })
  );
}
