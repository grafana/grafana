import { test } from '@grafana/plugin-e2e';

import { runDashboardNavigationCujs } from './dashboard-navigation-cuj';

test.use({
  featureToggles: {
    scopeFilters: true,
    groupByVariable: true,
  },
  openFeature: {
    flags: {
      reloadDashboardsOnParamsChange: true,
    },
  },
  openFeature: { flags: { 'grafana.scopesDashboardsMegaMenu': false } },
});

runDashboardNavigationCujs({ megaMenu: false });
