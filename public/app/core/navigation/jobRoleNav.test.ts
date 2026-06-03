import { type NavModelItem } from '@grafana/data';

import { filterNavTreeByJobRole } from './jobRoleNav';

const navTree: NavModelItem[] = [
  { id: 'home', text: 'Home' },
  { id: 'starred', text: 'Starred' },
  { id: 'dashboards/browse', text: 'Dashboards' },
  { id: 'explore', text: 'Explore' },
  { id: 'drilldown', text: 'Drilldown' },
  { id: 'alerting', text: 'Alerting' },
  { id: 'connections', text: 'Connections' },
  { id: 'apps', text: 'Apps' },
  { id: 'cfg', text: 'Administration' },
  { id: 'profile', text: 'Profile' },
  { id: 'help', text: 'Help' },
  { id: 'bookmarks', text: 'Bookmarks' },
];

const ids = (items: NavModelItem[]) => items.map((item) => item.id);
const childIds = (item?: NavModelItem) => item?.children?.map((child) => child.id) ?? [];

const cloudNavTree: NavModelItem[] = [
  { id: 'home', text: 'Home' },
  { id: 'dashboards/browse', text: 'Dashboards' },
  { id: 'explore', text: 'Explore' },
  {
    id: 'drilldown',
    text: 'Drilldown',
    children: [
      { id: 'plugin-page-grafana-metricsdrilldown-app', text: 'Metrics' },
      { id: 'plugin-page-grafana-lokiexplore-app', text: 'Logs' },
      { id: 'plugin-page-grafana-exploretraces-app', text: 'Traces' },
      { id: 'plugin-page-grafana-pyroscope-app', text: 'Profiles' },
      { id: 'plugin-page-grafana-sqldrilldown-app', text: 'SQL' },
    ],
  },
  { id: 'plugin-page-grafana-assistant-app', text: 'Assistant' },
  {
    id: 'alerts-and-incidents',
    text: 'Alerts & IRM',
    children: [
      { id: 'plugin-page-grafana-servicecenter-app', text: 'Service center' },
      { id: 'alerting', text: 'Alerting' },
      { id: 'plugin-page-grafana-irm-app', text: 'IRM' },
      { id: 'plugin-page-grafana-slo-app', text: 'SLO' },
      { id: 'plugin-page-grafana-labelmanagement-app', text: 'Label management' },
    ],
  },
  {
    id: 'adaptive-telemetry',
    text: 'Adaptive Telemetry',
    children: [
      { id: 'plugin-page-grafana-adaptive-metrics-app', text: 'Adaptive Metrics' },
      { id: 'plugin-page-grafana-adaptivelogs-app', text: 'Adaptive Logs' },
      { id: 'plugin-page-grafana-adaptivetraces-app', text: 'Adaptive Traces' },
      { id: 'plugin-page-grafana-adaptiveprofiles-app', text: 'Adaptive Profiles' },
    ],
  },
  {
    id: 'testing-and-synthetics',
    text: 'Testing & synthetics',
    children: [
      { id: 'plugin-page-k6-app', text: 'Performance' },
      { id: 'plugin-page-grafana-synthetic-monitoring-app', text: 'Synthetics' },
    ],
  },
  {
    id: 'observability',
    text: 'Observability',
    children: [
      { id: 'plugin-page-grafana-kowalski-app', text: 'Frontend' },
      { id: 'plugin-page-grafana-app-observability-app', text: 'Application' },
      { id: 'plugin-page-grafana-k8s-app', text: 'Kubernetes' },
      { id: 'plugin-page-grafana-dbo11y-app', text: 'Database' },
      { id: 'plugin-page-grafana-csp-app', text: 'Cloud provider' },
    ],
  },
  { id: 'plugin-page-grafana-ml-app', text: 'Machine Learning' },
  { id: 'plugin-page-grafana-cmab-app', text: 'Cost Management and Billing' },
  {
    id: 'connections',
    text: 'Connections',
    children: [
      { id: 'standalone-plugin-page-/connections/infrastructure', text: 'Manage Integrations' },
      { id: 'standalone-plugin-page-/a/grafana-collector-app/fleet-management', text: 'Fleet Management' },
    ],
  },
  {
    id: 'apps',
    text: 'More apps',
    children: [
      { id: 'plugin-page-grafana-dssql-app', text: 'Grafana Data Sources SQL' },
      { id: 'plugin-page-grafana-workflows-app', text: 'Workflows' },
    ],
  },
  {
    id: 'cfg',
    text: 'Administration',
    children: [
      { id: 'cfg/plugins', text: 'Plugins and data' },
      { id: 'cfg/access', text: 'Users and access' },
    ],
  },
];

describe('filterNavTreeByJobRole', () => {
  it('returns the full nav tree for the default role', () => {
    expect(filterNavTreeByJobRole(navTree, 'default')).toEqual(navTree);
  });

  it('returns the full nav tree for an unknown role', () => {
    expect(filterNavTreeByJobRole(navTree, 'support-engineer')).toEqual(navTree);
  });

  it('keeps SRE relevant sections and hides administration', () => {
    expect(ids(filterNavTreeByJobRole(navTree, 'sre'))).toEqual([
      'home',
      'starred',
      'dashboards/browse',
      'explore',
      'drilldown',
      'alerting',
      'connections',
      'apps',
      'profile',
      'help',
      'bookmarks',
    ]);
  });

  it('keeps data analyst relevant sections and hides alerting and administration', () => {
    expect(ids(filterNavTreeByJobRole(navTree, 'data-analyst'))).toEqual([
      'home',
      'starred',
      'dashboards/browse',
      'explore',
      'drilldown',
      'connections',
      'apps',
      'profile',
      'help',
      'bookmarks',
    ]);
  });

  it('keeps fake cloud operations apps for SREs', () => {
    const filtered = filterNavTreeByJobRole(cloudNavTree, 'sre');

    expect(ids(filtered)).toEqual([
      'home',
      'dashboards/browse',
      'explore',
      'drilldown',
      'plugin-page-grafana-assistant-app',
      'alerts-and-incidents',
      'adaptive-telemetry',
      'testing-and-synthetics',
      'observability',
      'connections',
      'apps',
    ]);
    expect(childIds(filtered.find((item) => item.id === 'alerts-and-incidents'))).toEqual([
      'plugin-page-grafana-servicecenter-app',
      'alerting',
      'plugin-page-grafana-irm-app',
      'plugin-page-grafana-slo-app',
      'plugin-page-grafana-labelmanagement-app',
    ]);
    expect(ids(filtered)).not.toContain('plugin-page-grafana-ml-app');
    expect(ids(filtered)).not.toContain('plugin-page-grafana-cmab-app');
    expect(ids(filtered)).not.toContain('cfg');
  });

  it('keeps fake cloud analyst apps and hides operations groups for data analysts', () => {
    const filtered = filterNavTreeByJobRole(cloudNavTree, 'data-analyst');

    expect(ids(filtered)).toEqual([
      'home',
      'dashboards/browse',
      'explore',
      'drilldown',
      'plugin-page-grafana-assistant-app',
      'plugin-page-grafana-ml-app',
      'plugin-page-grafana-cmab-app',
      'connections',
      'apps',
    ]);
    expect(ids(filtered)).not.toContain('alerts-and-incidents');
    expect(ids(filtered)).not.toContain('observability');
    expect(ids(filtered)).not.toContain('cfg');
  });

  it('keeps an exaggerated incident responder nav preset', () => {
    const filtered = filterNavTreeByJobRole(cloudNavTree, 'incident-responder');

    expect(ids(filtered)).toEqual([
      'home',
      'dashboards/browse',
      'explore',
      'drilldown',
      'plugin-page-grafana-assistant-app',
      'alerts-and-incidents',
      'observability',
    ]);
    expect(childIds(filtered.find((item) => item.id === 'alerts-and-incidents'))).toEqual([
      'plugin-page-grafana-servicecenter-app',
      'alerting',
      'plugin-page-grafana-irm-app',
      'plugin-page-grafana-slo-app',
      'plugin-page-grafana-labelmanagement-app',
    ]);
    expect(ids(filtered)).not.toContain('testing-and-synthetics');
    expect(ids(filtered)).not.toContain('connections');
    expect(ids(filtered)).not.toContain('cfg');
  });

  it('keeps an exaggerated platform engineer nav preset', () => {
    const filtered = filterNavTreeByJobRole(cloudNavTree, 'platform-engineer');

    expect(ids(filtered)).toEqual([
      'home',
      'dashboards/browse',
      'explore',
      'drilldown',
      'adaptive-telemetry',
      'testing-and-synthetics',
      'plugin-page-grafana-k8s-app',
      'plugin-page-grafana-csp-app',
      'connections',
      'cfg',
    ]);
    expect(ids(filtered)).not.toContain('observability');
    expect(ids(filtered)).not.toContain('alerts-and-incidents');
  });

  it('keeps an exaggerated application developer nav preset', () => {
    const filtered = filterNavTreeByJobRole(cloudNavTree, 'application-developer');

    expect(ids(filtered)).toEqual([
      'home',
      'dashboards/browse',
      'explore',
      'drilldown',
      'plugin-page-grafana-assistant-app',
      'plugin-page-grafana-synthetic-monitoring-app',
      'plugin-page-grafana-kowalski-app',
      'plugin-page-grafana-app-observability-app',
      'plugin-page-grafana-dbo11y-app',
    ]);
    expect(ids(filtered)).not.toContain('testing-and-synthetics');
    expect(ids(filtered)).not.toContain('observability');
    expect(ids(filtered)).not.toContain('alerts-and-incidents');
    expect(ids(filtered)).not.toContain('cfg');
  });

  it('keeps an exaggerated database engineer nav preset', () => {
    const filtered = filterNavTreeByJobRole(cloudNavTree, 'database-engineer');

    expect(ids(filtered)).toEqual([
      'home',
      'dashboards/browse',
      'explore',
      'plugin-page-grafana-sqldrilldown-app',
      'alerting',
      'plugin-page-grafana-dbo11y-app',
      'connections',
      'plugin-page-grafana-dssql-app',
      'cfg/plugins',
    ]);
    expect(ids(filtered)).not.toContain('drilldown');
    expect(ids(filtered)).not.toContain('alerts-and-incidents');
    expect(ids(filtered)).not.toContain('observability');
    expect(ids(filtered)).not.toContain('apps');
    expect(ids(filtered)).not.toContain('cfg');
  });
});
