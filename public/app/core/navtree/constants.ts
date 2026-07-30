// Mirrors the nav ordering in pkg/services/navtree/models.go: weights are
// derived from position, negative so default-weight items always sort below.
const NAV_ORDER = [
  'home',
  'bookmarks',
  'savedItems',
  'dashboards',
  'explore',
  'drilldown',
  'assistant',
  'sigil',
  'alerting',
  'alertsAndIncidents',
  'aiAndMl',
  'adaptiveTelemetry',
  'cmab',
  'testingAndSynthetics',
  'observability',
  'cloudServiceProviders',
  'infrastructure',
  'application',
  'asserts',
  'dataConnections',
  'apps',
  'plugin',
  'config',
  'profile',
  'help',
] as const;

/**
 * Turns the order above into sortWeight values (mirroring the Go weights in
 * pkg/services/navtree/models.go). Explicit weights, rather than array order,
 * are what let plugin and enterprise items insert themselves between static
 * items at merge time. Weights are negative so items without one (default 0)
 * always sort below the ordered set.
 */
function computeNavWeights(): Record<(typeof NAV_ORDER)[number], number> {
  const weights: Record<string, number> = {};
  NAV_ORDER.forEach((key, index) => {
    weights[key] = (index - 40) * 100;
  });
  return weights;
}

export const NavWeight = computeNavWeights();

// The values (slashes included, e.g. 'dashboards/browse') are load-bearing:
// the rest of the app looks nav items up by these strings (navIndex consumers,
// breadcrumbs, registered nav entries, preferences), so they form an app-wide
// contract and are not renameable here. While the server-built tree still
// exists behind grafana.multiTenantNavTree, these must also match the ids it
// emits so lookups resolve regardless of which tree produced a page.
export const NavID = {
  root: 'root',
  dashboards: 'dashboards/browse',
  explore: 'explore',
  drilldown: 'drilldown',
  adaptiveTelemetry: 'adaptive-telemetry',
  cfg: 'cfg',
  alertsAndIncidents: 'alerts-and-incidents',
  testingAndSynthetics: 'testing-and-synthetics',
  alerting: 'alerting',
  observability: 'observability',
  infrastructure: 'infrastructure',
  apps: 'apps',
  cfgGeneral: 'cfg/general',
  cfgPlugins: 'cfg/plugins',
  cfgAccess: 'cfg/access',
  bookmarks: 'bookmarks',
  connections: 'connections',
  starred: 'starred',
  home: 'home',
  help: 'help',
  profile: 'profile',
} as const;
