import { BackendSrv, GrafanaLiveSrv, LiveDataStreamOptions } from '@grafana/runtime';
import { CentrifugeSrv } from './centrifuge/service';

import { mergeMap, from, of, Observable } from 'rxjs';
import {
  DataQueryResponse,
  isValidLiveChannelAddress,
  LiveChannelAddress,
  LiveChannelConfig,
  LiveChannelConnectionState,
  LiveChannelEvent,
  LiveChannelEventType,
  LiveChannelPresenceStatus,
  LoadingState,
  toLiveChannelId,
} from '@grafana/data';
import { GrafanaLiveChannelConfigSrv } from './channel-config/types';
import { catchError } from 'rxjs/operators';

type GrafanaLiveServiceDeps = {
  scopes: GrafanaLiveChannelConfigSrv;
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
    const channelConfig = this.getChannelInfo(options.addr);

    return from(channelConfig).pipe(
      mergeMap((config) => this.deps.centrifugeSrv.getDataStream(options, config)),
      catchError((error) => this.getInvalidDataStream(error, options))
    );
  }

  /**
   * Watch for messages in a channel
   */
  getStream<T>(address: LiveChannelAddress): Observable<LiveChannelEvent<T>> {
    const channelConfig = this.getChannelInfo(address);
    return from(channelConfig).pipe(
      mergeMap((config) => this.deps.centrifugeSrv.getStream<T>(address, config)),
      catchError((error) => this.getInvalidChannelStream<T>(error, address))
    );
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
    const channelConfig = await this.getChannelInfo(address);
    return this.deps.centrifugeSrv.getPresence(address, channelConfig);
  }

  /**
   * Get a channel.  If the scope, namespace, or path is invalid, a shutdown
   * channel will be returned with an error state indicated in its status.
   *
   * This is a singleton instance that stays active until explicitly shutdown.
   * Multiple requests for this channel will return the same object until
   * the channel is shutdown
   */
  async getChannelInfo(addr: LiveChannelAddress): Promise<LiveChannelConfig> {
    if (!isValidLiveChannelAddress(addr)) {
      return Promise.reject('invalid live channel address');
    }

    if (!this.deps.scopes.doesScopeExist(addr.scope)) {
      return Promise.reject('invalid scope');
    }

    const support = await this.deps.scopes.getChannelSupport(addr.scope, addr.namespace);
    if (!support) {
      return Promise.reject(addr.namespace + ' does not support streaming');
    }
    return support.getChannelConfig(addr.path)!;
  }

  private getInvalidChannelStream = <T>(error: Error, address: LiveChannelAddress): Observable<LiveChannelEvent<T>> => {
    return of({
      type: LiveChannelEventType.Status,
      id: `${address.scope}/${address.namespace}/${address.path}`,
      timestamp: Date.now(),
      state: LiveChannelConnectionState.Invalid,
      error,
      message: error.message,
    });
  };

  private getInvalidDataStream = (error: Error, options: LiveDataStreamOptions): Observable<DataQueryResponse> => {
    return of({
      error: {
        data: {
          error: error.stack,
        },
        message: error.message,
      },
      state: LoadingState.Error,
      data: options.frame ? [options.frame] : [],
    });
  };
}
