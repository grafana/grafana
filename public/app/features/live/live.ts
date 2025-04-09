import { map } from 'rxjs';

import { toLiveChannelId, StreamingDataFrame } from '@grafana/data';
import { BackendSrv, GrafanaLiveSrv } from '@grafana/runtime';

import { CentrifugeSrv, StreamingDataQueryResponse } from './centrifuge/service';
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
   * Publish into a channel
   *
   * @alpha -- experimental
   */
  publish: GrafanaLiveSrv['publish'] = async (address, data, options) => {
    if (options?.useSocket) {
      return this.deps.centrifugeSrv.publish(address, data);
    }

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
