import { PartialObserver, Unsubscribable } from 'rxjs';

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
  isConnected(): boolean;

  initChannel<T>(path: string, handler: ChannelHandler<T>): void;

  subscribe<T>(path: string, observer?: PartialObserver<T>): Unsubscribable;
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
