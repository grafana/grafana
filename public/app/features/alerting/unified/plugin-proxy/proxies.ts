import { getDataSourceInstanceSettings } from '@grafana/runtime/unstable';

import { createBridgeURL } from '../components/PluginBridge';
import { SupportedPlugin } from '../types/pluginBridges';
import { ALERTMANAGER_NAME_QUERY_KEY } from '../utils/constants';
import { isGrafanaRulesSource } from '../utils/datasource';
import { parseQueryParamMatchers } from '../utils/matchers';
import { isDataSourceManagedIdentifier, toPluginRuleIdentifier, unescapePathSeparators } from '../utils/rule-id';

import { type ProxyContext, type ProxyHandler, type ProxyMatcher, type RouteProxy } from './types';

/**
 * The plugin's own pages. It does not mirror Grafana's paths, so every handler below translates
 * rather than passing the path straight through.
 */
const PLUGIN_ROUTES = {
  alerts: 'alerts',
  rules: 'rules',
  newRule: 'rules/new',
  routes: 'routes',
  receivers: 'receivers',
  templates: 'templates',
  silences: 'silences',
  newSilence: 'silences/new',
  timeIntervals: 'time-intervals',
  newTimeInterval: 'time-intervals/new',
} as const;

/**
 * Query params we add so the plugin can open the right drawer on a list page. Grafana has a URL for
 * each of these things and the plugin doesn't, so instead of dropping people on a list with no
 * context we point at the list and name the thing they were looking at.
 */
const DRAWER_PARAMS = {
  silence: 'silenceId',
  route: 'routeId',
  template: 'templateName',
  create: 'create',
  edit: 'edit',
  globalConfig: 'globalConfig',
} as const;

function pluginUrl(path: string, searchParams?: URLSearchParams): string {
  return createBridgeURL(SupportedPlugin.PrometheusAlerting, `/${path}`, searchParams);
}

function decode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    // A stray '%' makes decoding throw. Fall back to the raw value rather than blowing up the page.
    return value;
  }
}

/** A rules source or Alertmanager is data source managed unless it is the built-in Grafana one. */
function isDataSourceManaged(name: string | undefined): boolean {
  if (!name) {
    return false;
  }
  return !isGrafanaRulesSource(name);
}

/** Grafana's URLs name a data source, the plugin's want its UID. */
async function getDataSourceUid(name: string): Promise<string | undefined> {
  return (await getDataSourceInstanceSettings(name))?.uid;
}

/**
 * Which Alertmanager a page is showing comes from `?alertmanager=<name>`.
 *
 * We only look at the URL. The selection can also come from local storage (see
 * `AlertmanagerContext`), but reading that here would mean copying the context's precedence rules,
 * and a link without the param doesn't say anything about which Alertmanager the person sharing it
 * meant.
 */
const matchesExternalAlertmanager: ProxyMatcher = ({ searchParams }) =>
  isDataSourceManaged(decode(searchParams.get(ALERTMANAGER_NAME_QUERY_KEY) ?? ''));

/**
 * Builds a redirect for an Alertmanager page: swaps the Alertmanager name for the UID the plugin
 * identifies it by, then lets `buildPath` add to the params, drop the ones the plugin has no use
 * for, and pick the page to land on.
 */
function alertmanagerPage(
  buildPath: (params: URLSearchParams, context: ProxyContext) => string | undefined
): ProxyHandler {
  return async (context) => {
    const name = context.searchParams.get(ALERTMANAGER_NAME_QUERY_KEY);
    const uid = name ? await getDataSourceUid(decode(name)) : undefined;
    if (!uid) {
      return undefined;
    }

    const params = new URLSearchParams(context.searchParams);
    params.set(ALERTMANAGER_NAME_QUERY_KEY, uid);

    const path = buildPath(params, context);
    return path ? pluginUrl(path, params) : undefined;
  };
}

/** An Alertmanager page with nothing to translate beyond the Alertmanager itself. */
function alertmanagerPageProxy(path: string, pluginPath: string): RouteProxy {
  return { path, matches: matchesExternalAlertmanager, handler: alertmanagerPage(() => pluginPath) };
}

/** Grafana's rule name path params are escaped twice over — this unpicks them the same way `RedirectToRuleViewer` does. */
function decodeRuleName(value: string): string {
  return unescapePathSeparators(decode(unescapePathSeparators(value)));
}

const matchesDataSourceManagedRulesSource: ProxyMatcher = ({ params }) =>
  isDataSourceManaged(decode(params.sourceName ?? ''));

const rulePageProxies: RouteProxy[] = [
  {
    // /alerting/<source>/<identifier>/view -> /rules/<identifier>
    path: '/alerting/:sourceName/:id/view',
    matches: matchesDataSourceManagedRulesSource,
    handler: async ({ params, searchParams }) => {
      const identifier = await toPluginRuleIdentifier(params.id);
      return identifier ? pluginUrl(`${PLUGIN_ROUTES.rules}/${identifier}`, searchParams) : undefined;
    },
  },
  {
    // The "find a rule by name" page has no plugin equivalent, so search the rule list for it
    // instead. Both sides use the same search grammar.
    path: '/alerting/:sourceName/:name/find',
    matches: (context) => matchesDataSourceManagedRulesSource(context) && Boolean(context.params.name),
    handler: async ({ params, searchParams }) => {
      const terms = [`datasource:"${decode(params.sourceName ?? '')}"`, `rule:"${decodeRuleName(params.name ?? '')}"`];

      const namespace = searchParams.get('namespace');
      const group = searchParams.get('group');
      if (namespace) {
        terms.push(`namespace:"${namespace}"`);
      }
      if (group) {
        terms.push(`group:"${group}"`);
      }

      return pluginUrl(PLUGIN_ROUTES.rules, new URLSearchParams({ search: terms.join(' ') }));
    },
  },
  {
    // /alerting/<identifier>/edit -> /rules/<identifier>/edit
    path: '/alerting/:id/edit',
    matches: ({ params }) => isDataSourceManagedIdentifier(params.id),
    handler: async ({ params, searchParams }) => {
      const identifier = await toPluginRuleIdentifier(params.id);
      return identifier ? pluginUrl(`${PLUGIN_ROUTES.rules}/${identifier}/edit`, searchParams) : undefined;
    },
  },
  {
    // `recording` is the data source managed recording rule form, and `?copyFrom=` carries a rule
    // identifier which tells us who owns the rule being cloned. Plain `/alerting/new/alerting` is
    // left alone: whether that rule ends up Grafana or data source managed is chosen in the form.
    path: '/alerting/new/:type?',
    matches: ({ params, searchParams }) =>
      params.type === 'recording' || isDataSourceManagedIdentifier(searchParams.get('copyFrom') ?? undefined),
    handler: async ({ params, searchParams }) => {
      const copyFrom = searchParams.get('copyFrom');
      const clonedIdentifier = copyFrom ? await toPluginRuleIdentifier(copyFrom) : undefined;
      if (copyFrom && !clonedIdentifier) {
        // We know the rule is data source managed but couldn't resolve its data source.
        return undefined;
      }

      const pluginParams = new URLSearchParams(searchParams);
      // The plugin reads the rule type from `?type=` rather than from the path.
      if (params.type) {
        pluginParams.set('type', params.type);
      }
      if (clonedIdentifier) {
        pluginParams.set('copyFrom', decode(clonedIdentifier));
      }

      return pluginUrl(PLUGIN_ROUTES.newRule, pluginParams);
    },
  },
];

/** Group routes line up field for field — Grafana already uses the data source UID and namespace name here. */
const groupPageProxies: RouteProxy[] = (['view', 'edit'] as const).map((action) => ({
  path: `/alerting/:dataSourceUid/namespaces/:namespaceId/groups/:groupName/${action}`,
  matches: ({ params }: ProxyContext) =>
    isDataSourceManaged(params.dataSourceUid) && Boolean(params.namespaceId) && Boolean(params.groupName),
  handler: async ({ params, searchParams }: ProxyContext) => {
    const path = `groups/${params.dataSourceUid}/${params.namespaceId}/${params.groupName}`;
    return pluginUrl(action === 'edit' ? `${path}/edit` : path, searchParams);
  },
}));

const alertmanagerPageProxies: RouteProxy[] = [
  // Grafana's grouped alert instances view
  alertmanagerPageProxy('/alerting/groups/', PLUGIN_ROUTES.alerts),
  alertmanagerPageProxy('/alerting/notifications/templates', PLUGIN_ROUTES.templates),
  alertmanagerPageProxy('/alerting/routes', PLUGIN_ROUTES.routes),
  alertmanagerPageProxy('/alerting/routes/mute-timing', PLUGIN_ROUTES.timeIntervals),
  alertmanagerPageProxy('/alerting/routes/mute-timing/new', PLUGIN_ROUTES.newTimeInterval),
  alertmanagerPageProxy('/alerting/silences', PLUGIN_ROUTES.silences),
  {
    // Contact points and notification templates share one tabbed page in Grafana; the plugin has
    // two separate pages.
    path: '/alerting/notifications',
    matches: matchesExternalAlertmanager,
    handler: alertmanagerPage((params) => {
      const tab = params.get('tab');
      params.delete('tab');
      return tab === 'templates' ? PLUGIN_ROUTES.templates : PLUGIN_ROUTES.receivers;
    }),
  },
  {
    path: '/alerting/notifications/receivers/new',
    matches: matchesExternalAlertmanager,
    handler: alertmanagerPage((params) => {
      params.set(DRAWER_PARAMS.create, 'true');
      return PLUGIN_ROUTES.receivers;
    }),
  },
  {
    path: '/alerting/notifications/receivers/:name/edit',
    matches: (context) => matchesExternalAlertmanager(context) && Boolean(context.params.name),
    handler: alertmanagerPage((_params, { params }) => `${PLUGIN_ROUTES.receivers}/${params.name}`),
  },
  {
    // Grafana's template sub-routes: `new`, `<name>/edit`, `<name>/duplicate`. The plugin does all
    // three in a drawer on the templates page.
    path: '/alerting/notifications/templates/*',
    matches: matchesExternalAlertmanager,
    handler: alertmanagerPage((params, { params: routeParams }) => {
      const [name, action] = (routeParams['*'] ?? '').split('/');

      if (name === 'new') {
        params.set(DRAWER_PARAMS.create, 'true');
      } else if (name) {
        params.set(DRAWER_PARAMS.template, decode(name));
        if (action === 'duplicate') {
          params.set(DRAWER_PARAMS.create, 'true');
        }
      }

      return PLUGIN_ROUTES.templates;
    }),
  },
  {
    path: '/alerting/notifications/global-config',
    matches: matchesExternalAlertmanager,
    handler: alertmanagerPage((params) => {
      params.set(DRAWER_PARAMS.globalConfig, 'true');
      return PLUGIN_ROUTES.receivers;
    }),
  },
  {
    path: '/alerting/routes/policy/:name/edit',
    matches: (context) => matchesExternalAlertmanager(context) && Boolean(context.params.name),
    handler: alertmanagerPage((params, { params: routeParams }) => {
      params.set(DRAWER_PARAMS.route, decode(routeParams.name ?? ''));
      return PLUGIN_ROUTES.routes;
    }),
  },
  {
    // Grafana names the time interval with `?muteName=`, the plugin puts it in the path.
    path: '/alerting/routes/mute-timing/edit',
    matches: (context) => matchesExternalAlertmanager(context) && context.searchParams.has('muteName'),
    handler: alertmanagerPage((params) => {
      const muteName = params.get('muteName');
      if (!muteName) {
        return undefined;
      }

      params.delete('muteName');
      return `${PLUGIN_ROUTES.timeIntervals}/${encodeURIComponent(muteName)}`;
    }),
  },
  {
    // Grafana repeats `?matcher=key=value`; the plugin takes a single JSON `?matchers=`.
    path: '/alerting/silence/new',
    matches: matchesExternalAlertmanager,
    handler: alertmanagerPage((params) => {
      // parseQueryParamMatchers is what Grafana's own silence form uses to read this param, so we
      // accept exactly the same links. Its Matcher shape already matches what the plugin wants.
      const matchers = parseQueryParamMatchers(params.getAll('matcher'));

      params.delete('matcher');
      if (matchers.length) {
        params.set('matchers', JSON.stringify(matchers));
      }

      return PLUGIN_ROUTES.newSilence;
    }),
  },
  {
    // The plugin shows a single silence in a drawer on the list page.
    path: '/alerting/silence/:id/view',
    matches: (context: ProxyContext) => matchesExternalAlertmanager(context) && Boolean(context.params.id),
    handler: alertmanagerPage((params, { params: routeParams }) => {
      params.set(DRAWER_PARAMS.silence, routeParams.id ?? '');
      return PLUGIN_ROUTES.silences;
    }),
  },
  {
    // The plugin shows a single silence in a drawer on the list page.
    path: '/alerting/silence/:id/edit',
    matches: (context: ProxyContext) => matchesExternalAlertmanager(context) && Boolean(context.params.id),
    handler: alertmanagerPage((params, { params: routeParams }) => {
      params.set(DRAWER_PARAMS.silence, routeParams.id ?? '');
      params.set(DRAWER_PARAMS.edit, 'true');
      return PLUGIN_ROUTES.silences;
    }),
  },
];

/**
 * Pages we deliberately leave alone, because they show Grafana-managed and data source managed
 * things side by side and redirecting them would take working functionality away:
 *
 * - `/alerting/list` — one list covering both. A `datasource:"…"` search term filters it, it
 *   doesn't turn the page into a data source only page.
 * - `/alerting/admin/alertmanager` — lists the built-in Alertmanager next to the external ones.
 * - `/alerting/:id/modify-export`, `/alerting/export-new-rule`, `/alerting/import-*` — Grafana-managed
 *   by definition.
 */
export const routeProxies: RouteProxy[] = [...rulePageProxies, ...groupPageProxies, ...alertmanagerPageProxies];
