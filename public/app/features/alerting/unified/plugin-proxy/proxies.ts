/**
 * The proxy table: which alerting URLs belong to the `grafana-prometheusalerting-app` plugin, and
 * where in it each one goes.
 *
 * Fetched on demand by `withRouteProxy.tsx`, so this module is free to import whatever it needs.
 * Only the list of paths it covers is loaded up front, in `proxiedPaths.ts`.
 */
import { getDataSourceInstanceSettings } from '@grafana/runtime/unstable';

import { SupportedPlugin } from '../types/pluginBridges';
import { ALERTMANAGER_NAME_QUERY_KEY, GRAFANA_RULES_SOURCE_NAME } from '../utils/constants';
import { parseQueryParamMatchers } from '../utils/matchers';
import {
  isDataSourceManagedIdentifier,
  toPluginRuleIdentifier,
  tryDecodeUriComponent,
  unescapePathSeparators,
} from '../utils/rule-id';

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

/**
 * Splits a template sub-route into the template's name and what to do with it.
 *
 * Reads from the end rather than the start, because `matchPath` turns '%2F' into a real '/' (see
 * `reencodePathParam` above) and template names often contain one — external Alertmanagers key
 * their templates by file name. Splitting front to back would cut 'team/a.tmpl' down to 'team'.
 *
 * The last segment is always one of Grafana's own actions, so anything before it is the name.
 */
function splitTemplateRoute(remainder: string): { name: string; action?: string } {
  const match = /^(.*)\/(edit|duplicate)$/.exec(remainder);
  return match ? { name: match[1], action: match[2] } : { name: remainder };
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
/** A rules source or Alertmanager is data source managed unless it is the built-in Grafana one. */
function isDataSourceManaged(name: string | undefined): boolean {
  if (!name) {
    return false;
  }
  return name !== GRAFANA_RULES_SOURCE_NAME;
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
  isDataSourceManaged(tryDecodeUriComponent(searchParams.get(ALERTMANAGER_NAME_QUERY_KEY) ?? ''));

const matchesDataSourceManagedRulesSource: ProxyMatcher = ({ params }) =>
  isDataSourceManaged(tryDecodeUriComponent(params.sourceName ?? ''));

const matchesGroupPage: ProxyMatcher = ({ params }: ProxyContext) =>
  isDataSourceManaged(params.dataSourceUid) && Boolean(params.namespaceId) && Boolean(params.groupName);

/**
 * The proxy table. One entry per alerting route the plugin might serve: the route's path, how to
 * tell from the URL whether that particular one belongs to the plugin, and where in the plugin it
 * goes. All three sit together so an entry cannot half-exist.
 *
 * Routes opt in via `proxied()` in `routes.tsx`, and `routes.test.tsx` checks the two agree.
 */
export const routeProxies: RouteProxy[] = [
  {
    // Both halves of the URL have to agree that the rule is data source managed. Every link Grafana
    // builds for this route puts the full identifier in the path, so a bare UID here means the URL
    // contradicts itself and the handler was never going to resolve it.
    // /alerting/<source>/<identifier>/view -> /rules/<identifier>
    path: '/alerting/:sourceName/:id/view',
    matches: (context) =>
      matchesDataSourceManagedRulesSource(context) && isDataSourceManagedIdentifier(context.params.id),
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
        pluginParams.set('copyFrom', tryDecodeUriComponent(clonedIdentifier));
      }

      return pluginUrl(PLUGIN_ROUTES.newRule, pluginParams);
    },
  },
  {
    // Group routes line up field for field — Grafana already uses the data source UID and namespace
    // name here.
    path: '/alerting/:dataSourceUid/namespaces/:namespaceId/groups/:groupName/view',
    matches: matchesGroupPage,
    handler: groupPageHandler('view'),
  },
  {
    path: '/alerting/:dataSourceUid/namespaces/:namespaceId/groups/:groupName/edit',
    matches: matchesGroupPage,
    handler: groupPageHandler('edit'),
  },
  {
    // Alertmanager pages. All of these hinge on `?alertmanager=` naming something other than
    // Grafana's own, plus whatever the individual page needs to identify what it was showing.
    // Grafana's grouped alert instances view
    path: '/alerting/groups/',
    matches: matchesExternalAlertmanager,
    handler: alertmanagerPageHandler(PLUGIN_ROUTES.alerts),
  },
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
    path: '/alerting/notifications/global-config',
    matches: matchesExternalAlertmanager,
    handler: alertmanagerPage((params) => {
      params.set(DRAWER_PARAMS.globalConfig, 'true');
      return PLUGIN_ROUTES.receivers;
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
    handler: alertmanagerPage((_params, { params }) => `${PLUGIN_ROUTES.receivers}/${reencodePathParam(params.name)}`),
  },
  {
    path: '/alerting/notifications/templates',
    matches: matchesExternalAlertmanager,
    handler: alertmanagerPageHandler(PLUGIN_ROUTES.templates),
  },
  {
    // Grafana's template sub-routes: `new`, `<name>/edit`, `<name>/duplicate`. The plugin does all
    // three in a drawer on the templates page.
    path: '/alerting/notifications/templates/*',
    matches: matchesExternalAlertmanager,
    handler: alertmanagerPage((params, { params: routeParams }) => {
      const { name, action } = splitTemplateRoute(routeParams['*'] ?? '');

      // Only a create when there's no action after it — someone can name a template 'new', and
      // '<name>/edit' means edit whatever the name is.
      if (!action && name === 'new') {
        params.set(DRAWER_PARAMS.create, 'true');
      } else if (name) {
        params.set(DRAWER_PARAMS.template, tryDecodeUriComponent(name));
        if (action === 'duplicate') {
          params.set(DRAWER_PARAMS.create, 'true');
        }
      }

      return PLUGIN_ROUTES.templates;
    }),
  },
  {
    path: '/alerting/routes',
    matches: matchesExternalAlertmanager,
    handler: alertmanagerPageHandler(PLUGIN_ROUTES.routes),
  },
  {
    path: '/alerting/routes/policy/:name/edit',
    matches: (context) => matchesExternalAlertmanager(context) && Boolean(context.params.name),
    handler: alertmanagerPage((params, { params: routeParams }) => {
      params.set(DRAWER_PARAMS.route, tryDecodeUriComponent(routeParams.name ?? ''));
      return PLUGIN_ROUTES.routes;
    }),
  },
  {
    path: '/alerting/routes/mute-timing',
    matches: matchesExternalAlertmanager,
    handler: alertmanagerPageHandler(PLUGIN_ROUTES.timeIntervals),
  },
  {
    path: '/alerting/routes/mute-timing/new',
    matches: matchesExternalAlertmanager,
    handler: alertmanagerPageHandler(PLUGIN_ROUTES.newTimeInterval),
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
    path: '/alerting/silences',
    matches: matchesExternalAlertmanager,
    handler: alertmanagerPageHandler(PLUGIN_ROUTES.silences),
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
    matches: (context) => matchesExternalAlertmanager(context) && Boolean(context.params.id),
    handler: alertmanagerPage((params, { params: routeParams }) => {
      params.set(DRAWER_PARAMS.silence, routeParams.id ?? '');
      return PLUGIN_ROUTES.silences;
    }),
  },
  {
    path: '/alerting/silence/:id/edit',
    matches: (context) => matchesExternalAlertmanager(context) && Boolean(context.params.id),
    handler: alertmanagerPage((params, { params: routeParams }) => {
      params.set(DRAWER_PARAMS.silence, routeParams.id ?? '');
      params.set(DRAWER_PARAMS.edit, 'true');
      return PLUGIN_ROUTES.silences;
    }),
  },
];

export function findRouteProxy(routePath: string): RouteProxy | undefined {
  return routeProxies.find(({ path }) => path === routePath);
}
