/**
 * The handler half of the proxy table: given a URL the matchers have already accepted, work out
 * where in the `grafana-prometheusalerting-app` plugin it belongs.
 *
 * This module is loaded on demand, so unlike `matchers.ts` it is free to import whatever it needs.
 */
import { getDataSourceInstanceSettings } from '@grafana/runtime/unstable';

import { SupportedPlugin } from '../types/pluginBridges';
import { ALERTMANAGER_NAME_QUERY_KEY } from '../utils/constants';
import { parseQueryParamMatchers } from '../utils/matchers';
import { toPluginRuleIdentifier, tryDecodeUriComponent, unescapePathSeparators } from '../utils/rule-id';

import { type ProxiedRoutePath, routeMatchers } from './matchers';
import { type ProxyContext, type ProxyHandler, type RouteProxy } from './types';

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

/**
 * Same shape as `createBridgeURL`, written out here rather than imported. That one lives in a file
 * full of React components, and pulling a component tree in here would land it in the proxy's
 * chunk for no reason.
 */
function pluginUrl(path: string, searchParams?: URLSearchParams): string {
  const query = new URLSearchParams(searchParams).toString();
  return `/a/${SupportedPlugin.PrometheusAlerting}/${path}` + (query ? `?${query}` : '');
}

/**
 * Re-encodes a path param so it can be dropped into the plugin's path.
 *
 * `matchPath` hands params back still percent-encoded, with one exception: it turns `%2F` into a
 * literal `/`. So neither passing the value straight through nor encoding it outright is right —
 * the first breaks names containing a slash, the second double-encodes everything else. Decoding
 * and then encoding gets both cases to the same place.
 */
function reencodePathParam(value: string | undefined): string {
  return encodeURIComponent(tryDecodeUriComponent(value ?? ''));
}

/** Grafana's URLs name a data source, the plugin's want its UID. */
async function getDataSourceUid(name: string): Promise<string | undefined> {
  return (await getDataSourceInstanceSettings(name))?.uid;
}

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
    const uid = name ? await getDataSourceUid(tryDecodeUriComponent(name)) : undefined;
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
function alertmanagerPageHandler(pluginPath: string): ProxyHandler {
  return alertmanagerPage(() => pluginPath);
}

/** Grafana's rule name path params are escaped twice over — this unpicks them the same way `RedirectToRuleViewer` does. */
function decodeRuleName(value: string): string {
  return unescapePathSeparators(tryDecodeUriComponent(unescapePathSeparators(value)));
}

/** Group routes line up field for field — Grafana already uses the data source UID and namespace name here. */
function groupPageHandler(action: 'view' | 'edit'): ProxyHandler {
  return async ({ params, searchParams }: ProxyContext) => {
    const namespaceId = reencodePathParam(params.namespaceId);
    const groupName = reencodePathParam(params.groupName);
    const path = `groups/${params.dataSourceUid}/${namespaceId}/${groupName}`;
    return pluginUrl(action === 'edit' ? `${path}/edit` : path, searchParams);
  };
}

/**
 * Typed against the matcher list, so adding a path to `matchers.ts` without a handler here — or
 * a handler for a path that isn't matched — is a compile error, not a route that quietly stops
 * being proxied.
 */
const handlers: Record<ProxiedRoutePath, ProxyHandler> = {
  // /alerting/<source>/<identifier>/view -> /rules/<identifier>
  '/alerting/:sourceName/:id/view': async ({ params, searchParams }) => {
    const identifier = await toPluginRuleIdentifier(params.id);
    return identifier ? pluginUrl(`${PLUGIN_ROUTES.rules}/${identifier}`, searchParams) : undefined;
  },

  // The "find a rule by name" page has no plugin equivalent, so search the rule list for it
  // instead. Both sides use the same search grammar.
  '/alerting/:sourceName/:name/find': async ({ params, searchParams }) => {
    const terms = [
      `datasource:"${tryDecodeUriComponent(params.sourceName ?? '')}"`,
      `rule:"${decodeRuleName(params.name ?? '')}"`,
    ];

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

  // /alerting/<identifier>/edit -> /rules/<identifier>/edit
  '/alerting/:id/edit': async ({ params, searchParams }) => {
    const identifier = await toPluginRuleIdentifier(params.id);
    return identifier ? pluginUrl(`${PLUGIN_ROUTES.rules}/${identifier}/edit`, searchParams) : undefined;
  },

  '/alerting/new/:type?': async ({ params, searchParams }) => {
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
      pluginParams.set('copyFrom', tryDecodeUriComponent(clonedIdentifier));
    }

    return pluginUrl(PLUGIN_ROUTES.newRule, pluginParams);
  },

  '/alerting/:dataSourceUid/namespaces/:namespaceId/groups/:groupName/view': groupPageHandler('view'),
  '/alerting/:dataSourceUid/namespaces/:namespaceId/groups/:groupName/edit': groupPageHandler('edit'),

  // Grafana's grouped alert instances view
  '/alerting/groups/': alertmanagerPageHandler(PLUGIN_ROUTES.alerts),
  '/alerting/notifications/templates': alertmanagerPageHandler(PLUGIN_ROUTES.templates),
  '/alerting/routes': alertmanagerPageHandler(PLUGIN_ROUTES.routes),
  '/alerting/routes/mute-timing': alertmanagerPageHandler(PLUGIN_ROUTES.timeIntervals),
  '/alerting/routes/mute-timing/new': alertmanagerPageHandler(PLUGIN_ROUTES.newTimeInterval),
  '/alerting/silences': alertmanagerPageHandler(PLUGIN_ROUTES.silences),

  // Contact points and notification templates share one tabbed page in Grafana; the plugin has
  // two separate pages.
  '/alerting/notifications': alertmanagerPage((params) => {
    const tab = params.get('tab');
    params.delete('tab');
    return tab === 'templates' ? PLUGIN_ROUTES.templates : PLUGIN_ROUTES.receivers;
  }),

  '/alerting/notifications/receivers/new': alertmanagerPage((params) => {
    params.set(DRAWER_PARAMS.create, 'true');
    return PLUGIN_ROUTES.receivers;
  }),

  '/alerting/notifications/receivers/:name/edit': alertmanagerPage(
    (_params, { params }) => `${PLUGIN_ROUTES.receivers}/${reencodePathParam(params.name)}`
  ),

  // Grafana's template sub-routes: `new`, `<name>/edit`, `<name>/duplicate`. The plugin does all
  // three in a drawer on the templates page.
  '/alerting/notifications/templates/*': alertmanagerPage((params, { params: routeParams }) => {
    const [name, action] = (routeParams['*'] ?? '').split('/');

    if (name === 'new') {
      params.set(DRAWER_PARAMS.create, 'true');
    } else if (name) {
      params.set(DRAWER_PARAMS.template, tryDecodeUriComponent(name));
      if (action === 'duplicate') {
        params.set(DRAWER_PARAMS.create, 'true');
      }
    }

    return PLUGIN_ROUTES.templates;
  }),

  '/alerting/notifications/global-config': alertmanagerPage((params) => {
    params.set(DRAWER_PARAMS.globalConfig, 'true');
    return PLUGIN_ROUTES.receivers;
  }),

  '/alerting/routes/policy/:name/edit': alertmanagerPage((params, { params: routeParams }) => {
    params.set(DRAWER_PARAMS.route, tryDecodeUriComponent(routeParams.name ?? ''));
    return PLUGIN_ROUTES.routes;
  }),

  // Grafana names the time interval with `?muteName=`, the plugin puts it in the path.
  '/alerting/routes/mute-timing/edit': alertmanagerPage((params) => {
    const muteName = params.get('muteName');
    if (!muteName) {
      return undefined;
    }

    params.delete('muteName');
    return `${PLUGIN_ROUTES.timeIntervals}/${encodeURIComponent(muteName)}`;
  }),

  // Grafana repeats `?matcher=key=value`; the plugin takes a single JSON `?matchers=`.
  '/alerting/silence/new': alertmanagerPage((params) => {
    // parseQueryParamMatchers is what Grafana's own silence form uses to read this param, so we
    // accept exactly the same links. Its Matcher shape already matches what the plugin wants.
    const matchers = parseQueryParamMatchers(params.getAll('matcher'));

    params.delete('matcher');
    if (matchers.length) {
      params.set('matchers', JSON.stringify(matchers));
    }

    return PLUGIN_ROUTES.newSilence;
  }),

  // The plugin shows a single silence in a drawer on the list page.
  '/alerting/silence/:id/view': alertmanagerPage((params, { params: routeParams }) => {
    params.set(DRAWER_PARAMS.silence, routeParams.id ?? '');
    return PLUGIN_ROUTES.silences;
  }),

  '/alerting/silence/:id/edit': alertmanagerPage((params, { params: routeParams }) => {
    params.set(DRAWER_PARAMS.silence, routeParams.id ?? '');
    params.set(DRAWER_PARAMS.edit, 'true');
    return PLUGIN_ROUTES.silences;
  }),
};

export const routeProxies: RouteProxy[] = routeMatchers.map(({ path, matches }) => ({
  path,
  matches,
  handler: handlers[path],
}));

export function findRouteProxy(routePath: string): RouteProxy | undefined {
  return routeProxies.find(({ path }) => path === routePath);
}
