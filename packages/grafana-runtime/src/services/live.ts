import { Observable } from 'rxjs';

import {
  DataFrameJSON,
  DataQueryRequest,
  DataQueryResponse,
  LiveChannelAddress,
  LiveChannelEvent,
  LiveChannelPresenceStatus,
} from '@grafana/data';

/**
 * @alpha -- experimental
 */
export interface LiveDataFilter {
  fields?: string[];
}

/**
 * Indicate if the frame is appened or replace
 *
 * @alpha
 */
export enum StreamingFrameAction {
  Append = 'append',
  Replace = 'replace',
}

/**
 * @alpha
 */
export interface StreamingFrameOptions {
  maxLength: number; // 1000
  maxDelta: number; // how long to keep things
  action: StreamingFrameAction; // default will append

  /** optionally format field names based on labels */
  displayNameFormat?: string;
}

/**
 * @alpha
 */
export interface LiveDataStreamOptions {
  addr: LiveChannelAddress;
  frame?: DataFrameJSON; // initial results
  key?: string;
  buffer?: Partial<StreamingFrameOptions>;
  filter?: LiveDataFilter;
}

/**
 * @alpha -- experimental: send a normal query request over websockt
 */
export interface LiveQueryDataOptions {
  request: DataQueryRequest;
  body: any; // processed queries, same as sent to `/api/query/ds`
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
   * Watch for messages in a channel
   */
  getStream<T>(address: LiveChannelAddress): Observable<LiveChannelEvent<T>>;

  /**
   * Connect to a channel and return results as DataFrames
   */
  getDataStream(options: LiveDataStreamOptions): Observable<DataQueryResponse>;

  /**
   * Execute a query over the live websocket and potentiall subscribe to a live channel.
   *
   * Since the initial request and subscription are on the same socket, this will support HA setups
   *
   * @alpha -- this function requires the feature toggle `queryOverLive` to be set
   */
  getQueryData(options: LiveQueryDataOptions): Observable<DataQueryResponse>;

  /**
   * For channels that support presence, this will request the current state from the server.
   *
   * Join and leave messages will be sent to the open stream
   */
  getPresence(address: LiveChannelAddress): Promise<LiveChannelPresenceStatus>;

  /**
   * Publish into a channel
   *
   * @alpha -- experimental
   */
  publish(address: LiveChannelAddress, data: any): Promise<any>;
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
