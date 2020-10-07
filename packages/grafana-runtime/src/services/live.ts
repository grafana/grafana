import { LiveChannel, LiveChannelScope } from '@grafana/data';
import { Observable } from 'rxjs';

/**
 * @experimental
 */
export interface GrafanaLiveSrv {
  /**
   * Is the server currently connected
   */
  isConnected(): boolean;

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
  getChannel<TMessage, TPublish>(
    scope: LiveChannelScope,
    namespace: string,
    path: string
  ): LiveChannel<TMessage, TPublish>;
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
 * Used to retrieve the {@link GrafanaLiveSrv} that allows you to subscribe to
 * server side events and streams
 *
 * @experimental
 * @public
 */
export const getGrafanaLiveSrv = (): GrafanaLiveSrv => singletonInstance;
