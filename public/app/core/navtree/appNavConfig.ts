import { type IconName, type PluginInclude } from '@grafana/data';
import { GrafanaEdition } from '@grafana/data/internal';
import { config } from '@grafana/runtime';

import { NavID, NavWeight } from './constants';

export interface AppNavConfig {
  sectionId: string;
  sortWeight: number;
  text?: string;
  icon?: IconName | string;
  subTitle?: string;
  isNew?: boolean;
  /** Drops the `includes` that the app should not show in this deployment, on top of the RBAC checks */
  filterInclude?: (include: PluginInclude) => boolean;
}

// App plugin ids referenced by the placement rules below
const APP_OBSERVABILITY_APP_ID = 'grafana-app-observability-app';
const ASSERTS_APP_ID = 'grafana-asserts-app';
const ASSISTANT_APP_ID = 'grafana-assistant-app';
const SLO_APP_ID = 'grafana-slo-app';
const SERVICECENTER_APP_ID = 'grafana-servicecenter-app';

// The assistant pages OSS deployments get (mirrors assistantOSSNavigationPaths
// in the Go builder)
const ASSISTANT_OSS_NAV_PATHS = new Set([
  `/a/${ASSISTANT_APP_ID}`,
  `/a/${ASSISTANT_APP_ID}/workspace`,
  `/a/${ASSISTANT_APP_ID}/settings`,
]);

/**
 * Where known app plugins go in the nav. An app with no entry here is listed
 * under "More apps" by its plugin.json name, so add one only to place the app
 * somewhere specific or to change how it reads there:
 *
 * ```
 * 'myorg-widgets-app': {
 *   // Which section to appear in. NavID.root makes it a top-level item.
 *   sectionId: NavID.observability,
 *   // Position within the section — lower sorts higher.
 *   sortWeight: 6,
 *   // Shown instead of the plugin.json name. Also add a matching
 *   // `plugin-page-myorg-widgets-app` case to navBarItem-translations.ts:
 *   // display text is translated by nav id, and that lookup wins over this.
 *   text: 'Widgets',
 *   // Override the plugin's own icon and description in the same way.
 *   icon: 'apps',
 *   subTitle: 'Monitor your widgets',
 *   // Adds the "New" badge.
 *   isNew: true,
 * },
 * ```
 *
 * `filterInclude` covers the rarer case and is documented on AppNavConfig
 * above. Keep entries in step with the equivalent
 * table in the Go builder (applinks.go), which serves the same nav when the
 * client-built tree is off.
 */
const APP_NAV_CONFIG: Record<string, AppNavConfig> = {
  // --- Observability ---
  // Kept alongside grafana-agento11y-app until the sigil→agento11y rename completes
  'grafana-sigil-app': {
    sectionId: NavID.observability,
    sortWeight: 1,
    text: 'AI',
    isNew: true,
  },
  'grafana-agento11y-app': {
    sectionId: NavID.observability,
    sortWeight: 1,
    text: 'Agent',
    isNew: true,
  },
  [ASSERTS_APP_ID]: {
    sectionId: NavID.observability,
    sortWeight: 2,
    icon: 'asserts',
  },
  'grafana-kowalski-app': {
    sectionId: NavID.observability,
    sortWeight: 3,
    text: 'Frontend',
  },
  [APP_OBSERVABILITY_APP_ID]: {
    sectionId: NavID.observability,
    sortWeight: 4,
    text: 'Application',
  },
  'grafana-dbo11y-app': {
    sectionId: NavID.observability,
    sortWeight: 5,
    text: 'Database',
  },
  'grafana-k8s-app': {
    sectionId: NavID.observability,
    sortWeight: 6,
    text: 'Kubernetes',
  },
  'grafana-csp-app': {
    sectionId: NavID.observability,
    sortWeight: 7,
    icon: 'cloud-provider',
  },
  // --- Drilldown ---
  'grafana-metricsdrilldown-app': {
    sectionId: NavID.drilldown,
    sortWeight: 1,
    text: 'Metrics',
  },
  'grafana-lokiexplore-app': {
    sectionId: NavID.drilldown,
    sortWeight: 2,
    text: 'Logs',
  },
  'grafana-exploretraces-app': {
    sectionId: NavID.drilldown,
    sortWeight: 3,
    text: 'Traces',
  },
  'grafana-pyroscope-app': {
    sectionId: NavID.drilldown,
    sortWeight: 4,
    text: 'Profiles',
  },
  'grafana-sqldrilldown-app': {
    sectionId: NavID.drilldown,
    sortWeight: 5,
    text: 'SQL',
  },
  // --- Testing & synthetics ---
  'grafana-agentictesting-app': {
    sectionId: NavID.testingAndSynthetics,
    sortWeight: 1,
    text: 'Agentic testing',
    isNew: true,
  },
  'k6-app': {
    sectionId: NavID.testingAndSynthetics,
    sortWeight: 2,
    text: 'Performance',
  },
  'grafana-synthetic-monitoring-app': {
    sectionId: NavID.testingAndSynthetics,
    sortWeight: 3,
    text: 'Synthetics',
  },
  // --- Alerts & IRM ---
  [SERVICECENTER_APP_ID]: {
    sectionId: NavID.alertsAndIncidents,
    sortWeight: 1,
    text: 'Service Center',
  },
  'grafana-irm-app': {
    sectionId: NavID.alertsAndIncidents,
    sortWeight: 3,
    text: 'IRM',
  },
  [SLO_APP_ID]: {
    sectionId: NavID.alertsAndIncidents,
    sortWeight: 4,
  },
  'grafana-labelmanagement-app': {
    sectionId: NavID.alertsAndIncidents,
    sortWeight: 5,
    text: 'Label management',
  },
  'grafana-incident-app': {
    sectionId: NavID.alertsAndIncidents,
    sortWeight: 6,
    text: 'Incident',
  },
  'grafana-oncall-app': {
    sectionId: NavID.alertsAndIncidents,
    sortWeight: 7,
    text: 'OnCall',
  },
  // --- Top-level sections ---
  [ASSISTANT_APP_ID]: {
    sectionId: NavID.root,
    sortWeight: NavWeight.assistant,
    text: 'AI',
    subTitle: 'AI-powered assistant for Grafana',
    icon: 'ai-sparkle',
    // Enterprise and cloud stacks show every assistant page; OSS deployments
    // only the core ones. The Go builder additionally reads per-org plugin
    // jsonData, which is not readable client-side: an `ossMode` stack is
    // restricted to the OSS paths server-side but shows every page here, and
    // trial-mode orgs are restricted to a narrower set than we apply. Both are
    // cloud-only, so they over-show rather than hide anything.
    filterInclude: (include) =>
      config.buildInfo.edition !== GrafanaEdition.OpenSource ||
      config.namespace.startsWith('stacks-') ||
      (include.path !== undefined && ASSISTANT_OSS_NAV_PATHS.has(include.path)),
  },
  'grafana-ml-app': {
    sectionId: NavID.root,
    sortWeight: NavWeight.aiAndMl,
    text: 'Machine Learning',
    subTitle: 'Explore AI and machine learning features',
    icon: 'gf-ml-alt',
  },
  'grafana-cmab-app': {
    sectionId: NavID.root,
    sortWeight: NavWeight.cmab,
    icon: 'cmab-logo',
    isNew: true,
  },
  'grafana-easystart-app': {
    sectionId: NavID.root,
    sortWeight: NavWeight.apps + 1,
    text: 'Connections',
    icon: 'adjust-circle',
  },
  // --- Adaptive Telemetry ---
  'grafana-adaptive-metrics-app': {
    sectionId: NavID.adaptiveTelemetry,
    sortWeight: 1,
  },
  'grafana-adaptivelogs-app': {
    sectionId: NavID.adaptiveTelemetry,
    sortWeight: 2,
  },
  'grafana-adaptivetraces-app': {
    sectionId: NavID.adaptiveTelemetry,
    sortWeight: 3,
  },
  'grafana-adaptiveprofiles-app': {
    sectionId: NavID.adaptiveTelemetry,
    sortWeight: 4,
  },
  // --- Administration ---
  'grafana-cloud-link-app': {
    sectionId: NavID.cfgPlugins,
    sortWeight: 3,
  },
  'grafana-advisor-app': {
    sectionId: NavID.cfg,
    sortWeight: 0,
    text: 'Advisor',
    subTitle: 'Run checks and get suggestions to fix issues',
  },
  'grafana-auth-app': {
    sectionId: NavID.cfgAccess,
    sortWeight: 2,
    text: 'Access policies',
    subTitle: 'Use policies to control automated access to metrics, logs, traces, and other Grafana Cloud services',
  },
};

/** The built-in nav config for an app plugin, if it has one */
export function appNavConfigFor(appId: string): AppNavConfig | undefined {
  return APP_NAV_CONFIG[appId];
}
