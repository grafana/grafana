import { BackendSrv, GrafanaLiveSrv } from '@grafana/runtime';
import { CentrifugeSrv } from './centrifuge/service';

import { toLiveChannelId } from '@grafana/data';

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
    return this.deps.centrifugeSrv.getDataStream(options);
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
