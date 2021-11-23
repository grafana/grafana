import { BackendSrv, GrafanaLiveSrv, LiveDataStreamOptions } from '@grafana/runtime';
import { CentrifugeSrv } from './centrifuge/service';

import { Observable } from 'rxjs';
import {
  DataQueryResponse,
  LiveChannelAddress,
  LiveChannelEvent,
  LiveChannelPresenceStatus,
  toLiveChannelId,
} from '@grafana/data';

type GrafanaLiveServiceDeps = {
  centrifugeSrv: CentrifugeSrv;
  backendSrv: BackendSrv;
};

export class GrafanaLiveService implements GrafanaLiveSrv {
  constructor(private deps: GrafanaLiveServiceDeps) {}

  /**
   * Listen for changes to the connection state
   */
  getConnectionState(): Observable<boolean> {
    return this.deps.centrifugeSrv.getConnectionState();
  }

  /**
   * Connect to a channel and return results as DataFrames
   */
  getDataStream(options: LiveDataStreamOptions): Observable<DataQueryResponse> {
    return this.deps.centrifugeSrv.getDataStream(options);
  }

  /**
   * Watch for messages in a channel
   */
  getStream<T>(address: LiveChannelAddress): Observable<LiveChannelEvent<T>> {
    return this.deps.centrifugeSrv.getStream<T>(address);
  }

  /**
   * Publish into a channel
   *
   * @alpha -- experimental
   */
  async publish(address: LiveChannelAddress, data: any): Promise<any> {
    return this.deps.backendSrv.post(`api/live/publish`, {
      channel: toLiveChannelId(address), // orgId is from user
      data,
    });
  }

  /**
   * For channels that support presence, this will request the current state from the server.
   *
   * Join and leave messages will be sent to the open stream
   */
  async getPresence(address: LiveChannelAddress): Promise<LiveChannelPresenceStatus> {
    return this.deps.centrifugeSrv.getPresence(address);
  }
}
