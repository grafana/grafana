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
   * Listen for changes to the connection state
   */
  getConnectionState(): Observable<boolean>;

  /**
   * Subscribe to activity on a given channel.
   *
   * NOTE: this should be wrapped in try/catch because it may throw errors
   * if the plugin or path are invalid
   */
  getChannelStream<T>(plugin: string, path: string): Observable<T>;

  /**
   * Send data to a channel.  This feature is disabled for most channels and will return an error
   */
  publish<T>(plugin: string, path: string, data: any): Promise<T>;
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
