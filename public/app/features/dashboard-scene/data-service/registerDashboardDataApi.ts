import { provideDashboardDataApi } from 'app/features/plugins/components/restrictedGrafanaApis/dashboardData/dashboardDataApi';

import { DashboardDataApiImpl } from './DashboardDataApiImpl';

/**
 * Called when a dashboard page module loads rather than at startup: the implementation needs layout classes from the
 * lazily loaded dashboard chunk.
 */
export function registerDashboardDataApi() {
  provideDashboardDataApi(new DashboardDataApiImpl());
}
