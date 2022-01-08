import { DataFrameJSON, DataQueryResponse, LiveChannelScope, LoadingState, TimeRange } from '@grafana/data';
import { getGrafanaLiveSrv } from '@grafana/runtime';
import { map, Observable } from 'rxjs';
import LokiDatasource from './datasource';
import { LokiQuery } from './types';
import sha1 from 'tiny-hashes/sha1';
import { StreamingDataFrame } from 'app/features/live/data/StreamingDataFrame';

/**
 * Calculate a unique key for the query.  The key is used to pick a channel and should
 * be unique for each distinct query execution plan.  This key is not secure and is only picked to avoid
 * possible collisions
 */
export function getLiveStreamKey(query: LokiQuery): string {
  const txt = sha1(JSON.stringify({ expr: query.expr }));
  return txt.substring(0, 12);
}

// This will get both v1 and v2 result formats
export function doLokiChannelStream(
  query: LokiQuery,
  ds: LokiDatasource,
  range: TimeRange
): Observable<DataQueryResponse> {
  // maximum time to keep values
  const maxDelta = range.to.valueOf() - range.from.valueOf() + 1000;

  let frame: StreamingDataFrame | undefined = undefined;
  const updateFrame = (msg: any) => {
    if (msg?.message) {
      const p = msg.message as DataFrameJSON;
      if (!frame) {
        frame = StreamingDataFrame.fromDataFrameJSON(p, {
          maxLength: 5000, // hardcoded max buffer size?
          maxDelta,
          displayNameFormat: query.legendFormat,
        });
      } else {
        frame.push(p);
      }
    }
    return frame;
  };

  return getGrafanaLiveSrv()
    .getStream<any>({
      scope: LiveChannelScope.DataSource,
      namespace: ds.uid,
      path: `tail/${getLiveStreamKey(query)}`,
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
}
