import { type CloudRuleIdentifier, type PrometheusRuleIdentifier } from 'app/types/unified-alerting';

import { PROMETHEUS_ALERTING_APP_ID } from '../hooks/useDMAStatus';

import { getDatasourceAPIUid } from './datasource';
import * as ruleId from './rule-id';

const baseUrl = `/a/${PROMETHEUS_ALERTING_APP_ID}`;

export type PrometheusAlertingRuleIdentifier = CloudRuleIdentifier | PrometheusRuleIdentifier;

export type PluginRuleRoute =
  | { action: 'view' | 'edit' | 'clone'; identifier: PrometheusAlertingRuleIdentifier }
  | { action: 'create'; ruleType: 'alerting' | 'recording' };

/**
 * Navigation state forwarded to the plugin. Callers opt in per parameter rather than passing the
 * whole search string through, because Grafana-only params (`isManualRestore`, the Grafana form's
 * own `defaults` payload on edit routes) are meaningless to the plugin and `copyFrom` would clash.
 */
interface PluginRouteParams {
  type?: string;
  copyFrom?: string;
  defaults?: string;
  returnTo?: string;
  tab?: string;
}

interface NewRuleOptions extends Pick<PluginRouteParams, 'defaults' | 'returnTo'> {}
interface ViewRuleOptions extends Pick<PluginRouteParams, 'returnTo' | 'tab'> {}
interface RuleOptions extends Pick<PluginRouteParams, 'returnTo'> {}
interface GroupOptions extends Pick<PluginRouteParams, 'returnTo'> {}

function pluginRoute(path: string, params: PluginRouteParams = {}): string {
  const searchParams = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (value) {
      searchParams.set(key, value);
    }
  }

  const query = searchParams.toString();
  return query ? `${path}?${query}` : path;
}

const rulesUrl = `${baseUrl}/rules`;

function groupUrl(dataSourceUid: string, namespace: string, groupName: string) {
  return `${baseUrl}/groups/${encodeURIComponent(dataSourceUid)}/${encodeURIComponent(namespace)}/${encodeURIComponent(groupName)}`;
}

export const prometheusAlertingPlugin = {
  install: `/plugins/${PROMETHEUS_ALERTING_APP_ID}`,
  rules: rulesUrl,
  newRule: (type: 'alerting' | 'recording', options: NewRuleOptions = {}) =>
    pluginRoute(`${rulesUrl}/new`, { type, ...options }),
  viewRule: (identifier: PrometheusAlertingRuleIdentifier, options: ViewRuleOptions = {}) =>
    pluginRoute(`${rulesUrl}/${encodeURIComponent(pluginRuleIdentifier(identifier))}`, options),
  editRule: (identifier: PrometheusAlertingRuleIdentifier, options: RuleOptions = {}) =>
    pluginRoute(`${rulesUrl}/${encodeURIComponent(pluginRuleIdentifier(identifier))}/edit`, options),
  // No `type` is sent: the rule being copied determines it, and the plugin resolves that from `copyFrom`.
  // The identifier is passed unencoded because URLSearchParams encodes it.
  cloneRule: (identifier: PrometheusAlertingRuleIdentifier, options: RuleOptions = {}) =>
    pluginRoute(`${rulesUrl}/new`, { copyFrom: pluginRuleIdentifier(identifier), ...options }),
  viewGroup: (dataSourceUid: string, namespace: string, groupName: string, options: GroupOptions = {}) =>
    pluginRoute(groupUrl(dataSourceUid, namespace, groupName), options),
  editGroup: (dataSourceUid: string, namespace: string, groupName: string, options: GroupOptions = {}) =>
    pluginRoute(`${groupUrl(dataSourceUid, namespace, groupName)}/edit`, options),
};

/**
 * Returns the identifier unencoded. Callers embedding it in a path must encode it themselves;
 * callers passing it as a query param must not, because URLSearchParams already encodes.
 */
function pluginRuleIdentifier(identifier: PrometheusAlertingRuleIdentifier): string {
  const pluginIdentifier = { ...identifier, ruleSourceName: getDatasourceAPIUid(identifier.ruleSourceName) };

  return ruleId.stringifyIdentifier(pluginIdentifier);
}
