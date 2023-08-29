// This is the public API singleton instance
// we expose it to the public via getDashboardSrv

import { PluginsAPIDashboardSrvSingleton } from './DashboardSrvSingleton';
import { CoreDashboardSrv, PluginsAPIDashboardSrv } from './types';

// do not export
let publicSingletonInstance: PluginsAPIDashboardSrvSingleton;
/**
 * Internal method. Only for Grafana-core usage.
 *
 * Sets the DashboardSrv instance from grafana-core to be
 * exported to the public API
 * @private
 */
export function setDashboardSrv(instance: CoreDashboardSrv) {
  if (publicSingletonInstance) {
    throw new Error('DashboardSrv can only be set once.');
  }
  publicSingletonInstance = new PluginsAPIDashboardSrvSingleton(instance);
}

/**
 * Returns the current instance of the public DashboardSrv.
 * If no dashboard has been loaded, it returns 'undefined'.
 *
 * This is the public plugins API version. Do not use in Grafana core
 * @public
 */
export function getDashboardSrv(): PluginsAPIDashboardSrv | undefined {
  return publicSingletonInstance;
}
