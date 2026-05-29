import { map, type Observable, defer, mergeMap } from 'rxjs';

import {
  type DataFrameJSON,
  type DataQueryRequest,
  type DataQueryResponse,
  type LiveChannelEvent,
  LiveChannelScope,
  LoadingState,
  StreamingDataFrame,
} from '@grafana/data';
import { getGrafanaLiveSrv } from '@grafana/runtime';

import type DockerDatasource from './datasource';
import { type DockerQuery } from './types';

export async function getLiveStreamKey(query: DockerQuery): Promise<string> {
  return query.containerId ?? '';
}

export function doDockerChannelStream(
  query: DockerQuery,
  ds: DockerDatasource,
  options: DataQueryRequest<DockerQuery>
): Observable<DataQueryResponse> {
  const range = options.range;
  const maxDelta = range.to.valueOf() - range.from.valueOf() + 1000;
  let maxLength = options.maxDataPoints ?? 1000;
  if (maxLength > 1000) {
    maxLength *= 2;
  }

  let frame: StreamingDataFrame | undefined = undefined;
  const updateFrame = (msg: LiveChannelEvent<unknown>) => {
    if ('message' in msg && msg.message) {
      const p: DataFrameJSON = msg.message;
      if (!frame) {
        frame = StreamingDataFrame.fromDataFrameJSON(p, {
          maxLength,
          maxDelta,
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
        .getStream({
          scope: LiveChannelScope.DataSource,
          stream: ds.uid,
          path: `stats/${key}`,
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
