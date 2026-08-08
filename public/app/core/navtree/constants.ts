import { type NavModelItem } from '@grafana/data';

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

export interface PluginSectionShell {
  /** The section node created when the first plugin targeting it is merged in */
  shell: NavModelItem;
  /** Core sections that move inside this one when it is created (e.g. Alerting into Alerts & IRM) */
  absorbs?: Array<{ id: string; sortWeight: number }>;
  /** Take the section's img from the placed app's large logo */
  imgFromAppLogo?: boolean;
}

// The sections that only exist to group plugin nav items: created on demand
// when the first plugin targeting them is merged in. Urls are app-sub-url
// relative; children (and any dynamic fields) are filled at creation time.
export const PLUGIN_SECTION_SHELLS: Record<string, PluginSectionShell> = {
  [NavID.apps]: {
    shell: {
      text: 'More apps',
      icon: 'layer-group',
      subTitle: 'App plugins that extend the Grafana experience',
      id: NavID.apps,
      sortWeight: NavWeight.apps,
      url: '/apps',
    },
  },
  [NavID.observability]: {
    shell: {
      text: 'Observability',
      id: NavID.observability,
      subTitle:
        "Monitor infrastructure and applications in real time with Grafana Cloud's fully managed observability suite",
      icon: 'heart-rate',
      sortWeight: NavWeight.observability,
      url: '/observability',
    },
  },
  [NavID.infrastructure]: {
    shell: {
      text: 'Infrastructure',
      id: NavID.infrastructure,
      subTitle: "Understand your infrastructure's health",
      icon: 'heart-rate',
      sortWeight: NavWeight.infrastructure,
      url: '/infrastructure',
    },
  },
  [NavID.alertsAndIncidents]: {
    shell: {
      text: 'Alerts & IRM',
      id: NavID.alertsAndIncidents,
      subTitle: 'Alerting and incident management apps',
      icon: 'bell',
      sortWeight: NavWeight.alertsAndIncidents,
      url: '/alerts-and-incidents',
    },
    absorbs: [{ id: NavID.alerting, sortWeight: 2 }],
  },
  [NavID.testingAndSynthetics]: {
    shell: {
      text: 'Testing & synthetics',
      id: NavID.testingAndSynthetics,
      subTitle: 'Optimize performance with k6 and Synthetic Monitoring insights',
      icon: 'k6',
      sortWeight: NavWeight.testingAndSynthetics,
      url: '/testing-and-synthetics',
    },
  },
  [NavID.adaptiveTelemetry]: {
    shell: {
      text: 'Adaptive Telemetry',
      id: NavID.adaptiveTelemetry,
      subTitle:
        'Reduce noise, cut costs, and accelerate troubleshooting by intelligently ingesting only the telemetry data that matters most.',
      icon: 'adaptive-telemetry',
      sortWeight: NavWeight.adaptiveTelemetry,
      url: 'adaptive-telemetry',
      isNew: true,
    },
    // Icon URL comes from the Adaptive Telemetry plugins' logos (they all match)
    imgFromAppLogo: true,
  },
};
