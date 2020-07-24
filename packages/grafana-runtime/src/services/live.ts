import { PartialObserver, Unsubscribable } from 'rxjs';

/**
 * @experimental
 */
export interface ChannelHandler<T = any> {
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
 * Used to retrieve the {@link GrafanaLiveSrv} that can be used to communicate
 * via http(s) to a remote backend such as the Grafana backend, a datasource etc.
 *
 * @experimental
 * @public
 */
export const getGrafanaLiveSrv = (): GrafanaLiveSrv => singletonInstance;
