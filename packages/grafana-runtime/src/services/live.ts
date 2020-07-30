import { Observable } from 'rxjs';

/**
 * @experimental
 */
export interface ChannelHandler<T = any> {
  /**
   * Process the raw message from the server before broadcasting it
   * to all subscribeers on this channel
   */
  onPublish(msg: any): T;
}

// export interface SubscriptionEvents {
//   publish?: (ctx: PublicationContext) => void;
//   join?: (ctx: JoinLeaveContext) => void;
//   leave?: (ctx: JoinLeaveContext) => void;
//   subscribe?: (ctx: SubscribeSuccessContext) => void;
//   error?: (ctx: SubscribeErrorContext) => void;
//   unsubscribe?: (ctx: UnsubscribeContext) => void;
// }

/**
 * @experimental
 */
export interface GrafanaLiveSrv {
  /**
   * Is the server currently connected
   */
  isConnected(): boolean;

  /**
   * Listen for changes to the connection state
   */
  getConnectionState(): Observable<boolean>;

  /**
   * Configure a channel with the given setup
   */
  initChannel<T>(channel: string, handler: ChannelHandler<T>): void;

  /**
   * Subscribe to activity on a given channel
   */
  getChannelStream<T>(channel: string): Observable<T>;

  /**
   * Send data to a channel.  This feature is disabled for most channels and will return an error
   */
  publish<T>(channel: string, data: any): Promise<T>;
}

let singletonInstance: GrafanaLiveSrv;

/**
 * Used during startup by Grafana to set the GrafanaLiveSrv so it is available
 * via the the {@link getGrafanaLiveSrv} to the rest of the application.
 *
 * @internal
 */
export const setGrafanaLiveSrv = (instance: GrafanaLiveSrv) => {
  singletonInstance = instance;
};

/**
 * Used to retrieve the {@link GrafanaLiveSrv} that allows you to subscribe to
 * server side events and streams
 *
 * @experimental
 * @public
 */
export const getGrafanaLiveSrv = (): GrafanaLiveSrv => singletonInstance;
