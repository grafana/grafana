import { config, locationService } from '@grafana/runtime';

import { readNotebookSourceApp } from './captureSource';
import { NOTEBOOK_ENTRY_POINT } from './types';

it.each([
  ['grafana-agento11y-app', 'agent_o11y'],
  ['grafana-app-observability-app', 'app_o11y'],
  ['grafana-lokiexplore-app', 'logs_drilldown'],
  ['grafana-metricsdrilldown-app', 'metrics_drilldown'],
  ['grafana-exploretraces-app', 'traces_drilldown'],
  ['grafana-pyroscope-app', 'profiles_drilldown'],
  ['k6-app', 'k6'],
  ['grafana-irm-app', 'irm'],
  ['grafana-slo-app', 'slo'],
  ['grafana-synthetic-monitoring-app', 'synthetic_monitoring'],
  ['grafana-k8s-app', 'kubernetes'],
  ['grafana-dbo11y-app', 'database_o11y'],
  ['grafana-csp-app', 'cloud_provider_o11y'],
  ['grafana-kowalski-app', 'frontend_o11y'],
])('attributes %s captures to %s without recording the route', (pluginId, expected) => {
  locationService.push(`/a/${pluginId}/private-service-name?query=private-query`);
  expect(readNotebookSourceApp(NOTEBOOK_ENTRY_POINT.PLUGIN)).toBe(expected);
});

it('works when Grafana is served under a subpath', () => {
  const original = config.appSubUrl;
  config.appSubUrl = '/grafana';
  try {
    locationService.push('/grafana/a/k6-app/tests/123');
    expect(readNotebookSourceApp(NOTEBOOK_ENTRY_POINT.PLUGIN)).toBe('k6');
  } finally {
    config.appSubUrl = original;
  }
});

it.each(['/a/private-plugin-app', '/a/constructor', '/d/dashboard', '/d/dashboard/a/grafana-k6-app'])(
  'uses a bounded fallback for %s',
  (path) => {
    locationService.push(path);
    expect(readNotebookSourceApp(NOTEBOOK_ENTRY_POINT.PLUGIN)).toBe('other_plugin');
  }
);

it('does not attribute non-plugin captures to the current app', () => {
  locationService.push('/a/grafana-agento11y-app/analytics');
  expect(readNotebookSourceApp(NOTEBOOK_ENTRY_POINT.EXPLORE)).toBeUndefined();
  expect(readNotebookSourceApp(NOTEBOOK_ENTRY_POINT.DASHBOARD_PANEL)).toBeUndefined();
});
