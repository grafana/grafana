import { test, expect } from '@grafana/plugin-e2e';

import scopesDashboardOne from '../dashboards/scopes-cujs/scopeDashboardOne.json';
import scopesDashboardTwo from '../dashboards/scopes-cujs/scopeDashboardTwo.json';

test.use({
  featureToggles: {
    scopeFilters: true,
    groupByVariable: true,
    reloadDashboardsOnParamsChange: true,
  },
});

const USE_LIVE_DATA = process.env.USE_LIVE_DATA;
const LIVE_DASHBOARD_UID = process.env.LIVE_DASHBOARD_UID;

export const FIRST_DASHBOARD = USE_LIVE_DATA && LIVE_DASHBOARD_UID ? LIVE_DASHBOARD_UID : 'scopes-dashboard-1';

test.describe(
  'AdHoc Filters CUJs',
  {
    tag: ['@adhocs-cujs'],
  },
  () => {
    //todo
  }
);
