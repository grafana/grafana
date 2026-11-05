import { test } from '@grafana/plugin-e2e';

import { runDashboardNavigationCujs } from './dashboard-navigation-cuj';

test.use({
  featureToggles: {
    scopeFilters: true,
  },
  openFeature: {
    flags: {
      reloadDashboardsOnParamsChange: true,
      'grafana.scopesDashboardsMegaMenu': false,
    },
  },
});

runDashboardNavigationCujs({ megaMenu: false });
