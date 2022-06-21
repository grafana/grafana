import { from, map, of, switchMap } from 'rxjs';

import { DataFrame, toLiveChannelId } from '@grafana/data';
import { BackendSrv, GrafanaLiveSrv, toDataQueryResponse } from '@grafana/runtime';
import {
  standardStreamOptionsProvider,
  toStreamingDataResponse,
} from '@grafana/runtime/src/utils/DataSourceWithBackend';

import { CentrifugeSrv, StreamingDataQueryResponse } from './centrifuge/service';
import { StreamingDataFrame } from './data/StreamingDataFrame';
import { isStreamingResponseData, StreamingResponseDataType } from './data/utils';

type GrafanaLiveServiceDeps = {
  centrifugeSrv: CentrifugeSrv;
  backendSrv: BackendSrv;
};

export class GrafanaLiveService implements GrafanaLiveSrv {
  constructor(private deps: GrafanaLiveServiceDeps) {}

  /**
   * Listen for changes to the connection state
   */
  getConnectionState = () => {
    return this.deps.centrifugeSrv.getConnectionState();
  };

  /**
   * Connect to a channel and return results as DataFrames
   */
  getDataStream: GrafanaLiveSrv['getDataStream'] = (options) => {
    let buffer: StreamingDataFrame;

    const updateBuffer = (next: StreamingDataQueryResponse): void => {
      const data = next.data[0];
      if (!buffer && !isStreamingResponseData(data, StreamingResponseDataType.FullFrame)) {
        console.warn(`expected first packet to contain a full frame, received ${data?.type}`);
        return;
      }

      switch (data.type) {
        case StreamingResponseDataType.FullFrame: {
          buffer = StreamingDataFrame.deserialize(data.frame);
          return;
        }
        case StreamingResponseDataType.NewValuesSameSchema: {
          buffer.pushNewValues(data.values);
          return;
        }
      }
    };

    return this.deps.centrifugeSrv.getDataStream(options).pipe(
      map((next) => {
        updateBuffer(next);
        return {
          ...next,
          data: [buffer ?? StreamingDataFrame.empty()],
        };
      })
    );
  };

  /**
   * Watch for messages in a channel
   */
  getStream: GrafanaLiveSrv['getStream'] = (address) => {
    return this.deps.centrifugeSrv.getStream(address);
  };

  /**
   * Execute a query over the live websocket and potentially subscribe to a live channel.
   *
   * Since the initial request and subscription are on the same socket, this will support HA setups
   */
  getQueryData: GrafanaLiveSrv['getQueryData'] = (options) => {
    return from(this.deps.centrifugeSrv.getQueryData(options)).pipe(
      switchMap((rawResponse) => {
        const parsedResponse = toDataQueryResponse(rawResponse, options.request.targets);

        const isSubscribable =
          parsedResponse.data?.length && parsedResponse.data.find((f: DataFrame) => f.meta?.channel);

        return isSubscribable
          ? toStreamingDataResponse(parsedResponse, options.request, standardStreamOptionsProvider)
          : of(parsedResponse);
      })
    );
  };

  /**
   * Publish into a channel
   *
   * @alpha -- experimental
   */
  publish: GrafanaLiveSrv['publish'] = async (address, data) => {
    return this.deps.backendSrv.post(`api/live/publish`, {
      channel: toLiveChannelId(address), // orgId is from user
      data,
    });
  };

  /**
   * For channels that support presence, this will request the current state from the server.
   *
   * Join and leave messages will be sent to the open stream
   */
  getPresence: GrafanaLiveSrv['getPresence'] = (address) => {
    return this.deps.centrifugeSrv.getPresence(address);
  };
}
