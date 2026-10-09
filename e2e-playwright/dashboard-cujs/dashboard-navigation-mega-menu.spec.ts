import { test } from '@grafana/plugin-e2e';

import { runDashboardNavigationCujs } from './dashboard-navigation-cuj';

// Same CUJs as dashboard-navigation.spec.ts, but with the scopes-suggested dashboards tree rendered
// inside the mega menu instead of the standalone docked drawer. The two never render simultaneously
// (gated by this flag), and reuse the same data-testids/components, so the exact same test body
// applies to both - see dashboard-navigation-cuj.ts for why this needs its own spec file rather than
// a second describe block in dashboard-navigation.spec.ts.
test.use({
  featureToggles: {
    scopeFilters: true,
    groupByVariable: true,
    reloadDashboardsOnParamsChange: true,
    dashboardUnifiedDrilldownControls: false,
  },
  openFeature: { flags: { 'grafana.scopesDashboardsMegaMenu': true } },
});

runDashboardNavigationCujs();
