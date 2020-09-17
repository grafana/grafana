import { Observable } from 'rxjs';

/**
 * @experimental
 */
export interface ChannelHandler<T = any> {
  /**
   * Indicate if the channel should try to publish to the service.  Even when
   * this is enabled, the backend support for the channel may not support publish
   */
  allowPublish?: boolean;

  /**
   * Process the raw message from the server before broadcasting it
   * to the channel stream
   */
  onMessageReceived(msg: any): T;
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
   * Register channel support on a given path.  Plugins should call this function
   * on initalization to specify which paths should support streaming responses.
   *
   * If the path ends in "*" it will will be applied to everything with this prefix
   *
   * Optionally define custom behavior for the channel
   */
  registerChannelSupport<T>(plugin: string, path: string, handler?: ChannelHandler<T>): void;

  /**
   * Subscribe to activity on a given channel.  The channel is identified by a plugin and path:
   *   `${pluginId}/path`
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
