import {
  DataFrame,
  DataQueryResponse,
  LiveChannelAddress,
  LiveChannelConfig,
  LiveChannelEvent,
  LiveChannelPresenceStatus,
  StreamingFrameOptions,
} from '@grafana/data';
import { Observable } from 'rxjs';

/**
 * @alpha -- experimental
 */
export interface LiveDataFilter {
  fields?: string[];
}

/**
 * @alpha
 */
export interface LiveDataStreamOptions {
  addr: LiveChannelAddress;
  frame?: DataFrame; // initial results
  key?: string;
  buffer?: StreamingFrameOptions;
  filter?: LiveDataFilter;
}

/**
 * @alpha -- experimental
 */
export interface GrafanaLiveSrv {
  /**
   * Listen for changes to the main service
   */
  getConnectionState(): Observable<boolean>;

  /**
   * Get a channel.  If the scope, namespace, or path is invalid, a shutdown
   * channel will be returned with an error state indicated in its status.
   *
   * This is a singleton instance that stays active until explicitly shutdown.
   * Multiple requests for this channel will return the same object until
   * the channel is shutdown
   */
  getChannelInfo(address: LiveChannelAddress): Promise<LiveChannelConfig>;

  /**
   * Watch for messages in a channel
   */
  getStream<T>(address: LiveChannelAddress): Observable<LiveChannelEvent<T>>;

  /**
   * Connect to a channel and return results as DataFrames
   */
  getDataStream(options: LiveDataStreamOptions): Observable<DataQueryResponse>;

  /**
   * For channels that support presence, this will request the current state from the server.
   *
   * Join and leave messages will be sent to the open stream
   */
  getPresence(address: LiveChannelAddress): Promise<LiveChannelPresenceStatus>;
}

let singletonInstance: GrafanaLiveSrv;

/**
 * Used during startup by Grafana to set the GrafanaLiveSrv so it is available
 * via the {@link getGrafanaLiveSrv} to the rest of the application.
 *
 * @internal
 */
export const setGrafanaLiveSrv = (instance: GrafanaLiveSrv) => {
  singletonInstance = instance;
};

/**
 * Used to retrieve the GrafanaLiveSrv that allows you to subscribe to
 * server side events and streams
 *
 * @alpha -- experimental
 */
export const getGrafanaLiveSrv = (): GrafanaLiveSrv => singletonInstance;
