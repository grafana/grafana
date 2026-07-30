import { type NavModelItem } from '@grafana/data';

// The order (and therefore sort weight) of every nav section, mirroring the
// WeightX iota constants in pkg/services/navtree/models.go. It MUST stay in
// lockstep with the Go order: the client- and server-built trees are merged
// for plugin/enterprise items that carry server-assigned weights, so if a
// section is added on only one side those items interleave differently and
// nothing catches it (until a golden parity test lands).
//
// It is kept separate from NavID (rather than deriving order from it) because
// it also positions weight-only anchors that have no NavID (assistant, sigil,
// aiAndMl, cmab, application, asserts, dataConnections, plugin, ...) and groups
// several NavIDs under one weight (savedItems ← starred/bookmarks, config ←
// cfg, dataConnections ← connections).
const NAV_ORDER = [
  'home',
  'bookmarks',
  'savedItems',
  'dashboards',
  'explore',
  'drilldown',
  'notebooks',
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
 * Turns the order above into sortWeight values. Explicit weights, rather than
 * array order, are what let plugin and enterprise items insert themselves
 * between static items at merge time. Weights are negative so items without
 * one (default 0) always sort below the ordered set.
 */
function computeNavWeights(): Record<(typeof NAV_ORDER)[number], number> {
  const weights: Record<string, number> = {};
  NAV_ORDER.forEach((key, index) => {
    // Mirrors Go's `WeightHome = (iota - 40) * 100` (pkg/services/navtree/models.go):
    // the -40 offset keeps the ordered sections negative so unweighted items sort below.
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
  notebooks: 'notebooks',
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

/** The set of known nav ids (the literal values of NavID). */
export type NavId = (typeof NavID)[keyof typeof NavID];

/** Nav id of an app plugin's own entry/section (matches the Go builder's ids) */
export const pluginPageId = (pluginId: string) => `plugin-page-${pluginId}`;

/** Nav id of a plugin page rendered standalone inside a core section */
export const standalonePluginPageId = (key: string) => `standalone-plugin-page-${key}`;

// The sections that only exist to group plugin nav items: created on demand
// when the first plugin targeting them is merged in. Urls are app-sub-url
// relative; children (and any dynamic fields) are filled at creation time.
export const PLUGIN_SECTION_SHELLS: Record<string, NavModelItem> = {
  [NavID.apps]: {
    text: 'More apps',
    icon: 'layer-group',
    subTitle: 'App plugins that extend the Grafana experience',
    id: NavID.apps,
    sortWeight: NavWeight.apps,
    url: '/apps',
  },
  [NavID.observability]: {
    text: 'Observability',
    id: NavID.observability,
    subTitle:
      "Monitor infrastructure and applications in real time with Grafana Cloud's fully managed observability suite",
    icon: 'heart-rate',
    sortWeight: NavWeight.observability,
    url: '/observability',
  },
  [NavID.infrastructure]: {
    text: 'Infrastructure',
    id: NavID.infrastructure,
    subTitle: "Understand your infrastructure's health",
    icon: 'heart-rate',
    sortWeight: NavWeight.infrastructure,
    url: '/infrastructure',
  },
  [NavID.alertsAndIncidents]: {
    text: 'Alerts & IRM',
    id: NavID.alertsAndIncidents,
    subTitle: 'Alerting and incident management apps',
    icon: 'bell',
    sortWeight: NavWeight.alertsAndIncidents,
    url: '/alerts-and-incidents',
  },
  [NavID.testingAndSynthetics]: {
    text: 'Testing & synthetics',
    id: NavID.testingAndSynthetics,
    subTitle: 'Optimize performance with k6 and Synthetic Monitoring insights',
    icon: 'k6',
    sortWeight: NavWeight.testingAndSynthetics,
    url: '/testing-and-synthetics',
  },
  [NavID.adaptiveTelemetry]: {
    text: 'Adaptive Telemetry',
    id: NavID.adaptiveTelemetry,
    subTitle:
      'Reduce noise, cut costs, and accelerate troubleshooting by intelligently ingesting only the telemetry data that matters most.',
    icon: 'adaptive-telemetry',
    sortWeight: NavWeight.adaptiveTelemetry,
    url: 'adaptive-telemetry',
    isNew: true,
  },
};
