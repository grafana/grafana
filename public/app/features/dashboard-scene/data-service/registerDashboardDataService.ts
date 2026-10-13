import { getDashboardDataService, setDashboardDataService } from '@grafana/runtime';

import { DashboardDataServiceImpl } from './DashboardDataServiceImpl';

/**
 * Called when a dashboard page module loads rather than at startup: the service needs layout classes from the
 * lazily loaded dashboard chunk.
 */
export function registerDashboardDataService() {
  if (!getDashboardDataService()) {
    setDashboardDataService(new DashboardDataServiceImpl());
  }
}
