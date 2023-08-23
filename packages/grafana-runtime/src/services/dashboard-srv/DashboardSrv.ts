// This is the public API singleton instance
// we expose it to the public via getDashboardSrv

import { PublicDashboardSrvSingleton } from './DashboardSrvSingleton';
import { PublicDashboardSrv } from './types';

// do not export
let publicSingletonInstance: PublicDashboardSrvSingleton;
/**
 * Internal method. Only for Grafana-core usage.
 *
 * Sets the DashboardSrv instance from grafana-core to be
 * exported to the public API
 * @private
 */
export function __setDashboardSrv(instance: Partial<PublicDashboardSrv>) {
  if (publicSingletonInstance) {
    throw new Error('DashboardSrv can only be set once.');
  }
  publicSingletonInstance = new PublicDashboardSrvSingleton(instance);
}

/**
 * Returns the current instance of the public DashboardSrv.
 * If no dashboard has been loaded, it returns 'undefined'.
 * @public
 */
export function getDashboardSrv(): PublicDashboardSrvSingleton | undefined {
  return publicSingletonInstance;
}
