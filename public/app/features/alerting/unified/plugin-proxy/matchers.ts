/**
 * Which alerting URLs belong to the `grafana-prometheusalerting-app` plugin, and how to tell from
 * the URL alone.
 *
 * This half of the proxy table is deliberately dependency-free: the alerting route table imports
 * it while the app is starting up, so anything it reaches lands in the first bundle the browser
 * downloads. The handlers that build the plugin URLs live in `proxies.ts`, which is loaded on
 * demand and free to import whatever it needs.
 *
 * Keeping the answer synchronous matters for the common case. Most people opening
 * `/alerting/silences` are looking at Grafana's own Alertmanager, and they should get that page
 * straight away rather than waiting while we fetch code to work out that nothing needs to happen.
 */
import { ALERTMANAGER_NAME_QUERY_KEY, GRAFANA_RULES_SOURCE_NAME } from '../utils/constants';
import { isDataSourceManagedIdentifier, tryDecodeUriComponent } from '../utils/rule-identifier';

import { type ProxyContext, type ProxyMatcher } from './types';

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
 * Paths must be character-for-character the ones in `getAlertingRoutes()`, and every path here
 * needs a handler of the same name in `proxies.ts` — that half is typed against this list, so a
 * missing handler is a compile error rather than a route that quietly stops being proxied.
 */
export const routeMatchers = [
  // /alerting/<source>/<identifier>/view -> /rules/<identifier>
  {
    path: '/alerting/:sourceName/:id/view',
    // Both halves of the URL have to agree that the rule is data source managed. Every link
    // Grafana builds for this route puts the full identifier in the path, so a bare UID here means
    // the URL contradicts itself and the handler was never going to resolve it.
    matches: (context) =>
      matchesDataSourceManagedRulesSource(context) && isDataSourceManagedIdentifier(context.params.id),
  },
  // The "find a rule by name" page has no plugin equivalent, so the handler searches the rule list.
  {
    path: '/alerting/:sourceName/:name/find',
    matches: (context) => matchesDataSourceManagedRulesSource(context) && Boolean(context.params.name),
  },
  // /alerting/<identifier>/edit -> /rules/<identifier>/edit
  {
    path: '/alerting/:id/edit',
    matches: ({ params }) => isDataSourceManagedIdentifier(params.id),
  },
  // `recording` is the data source managed recording rule form, and `?copyFrom=` carries a rule
  // identifier which tells us who owns the rule being cloned. Plain `/alerting/new/alerting` is
  // left alone: whether that rule ends up Grafana or data source managed is chosen in the form.
  {
    path: '/alerting/new/:type?',
    matches: ({ params, searchParams }) =>
      params.type === 'recording' || isDataSourceManagedIdentifier(searchParams.get('copyFrom') ?? undefined),
  },
  // Group routes line up field for field — Grafana already uses the data source UID and namespace
  // name here.
  {
    path: '/alerting/:dataSourceUid/namespaces/:namespaceId/groups/:groupName/view',
    matches: matchesGroupPage,
  },
  {
    path: '/alerting/:dataSourceUid/namespaces/:namespaceId/groups/:groupName/edit',
    matches: matchesGroupPage,
  },
  // Alertmanager pages. All of these hinge on `?alertmanager=` naming something other than
  // Grafana's own, plus whatever the individual page needs to identify what it was showing.
  { path: '/alerting/groups/', matches: matchesExternalAlertmanager },
  { path: '/alerting/notifications/templates', matches: matchesExternalAlertmanager },
  { path: '/alerting/routes', matches: matchesExternalAlertmanager },
  { path: '/alerting/routes/mute-timing', matches: matchesExternalAlertmanager },
  { path: '/alerting/routes/mute-timing/new', matches: matchesExternalAlertmanager },
  { path: '/alerting/silences', matches: matchesExternalAlertmanager },
  { path: '/alerting/notifications', matches: matchesExternalAlertmanager },
  { path: '/alerting/notifications/receivers/new', matches: matchesExternalAlertmanager },
  {
    path: '/alerting/notifications/receivers/:name/edit',
    matches: (context) => matchesExternalAlertmanager(context) && Boolean(context.params.name),
  },
  { path: '/alerting/notifications/templates/*', matches: matchesExternalAlertmanager },
  { path: '/alerting/notifications/global-config', matches: matchesExternalAlertmanager },
  {
    path: '/alerting/routes/policy/:name/edit',
    matches: (context) => matchesExternalAlertmanager(context) && Boolean(context.params.name),
  },
  {
    path: '/alerting/routes/mute-timing/edit',
    matches: (context) => matchesExternalAlertmanager(context) && context.searchParams.has('muteName'),
  },
  { path: '/alerting/silence/new', matches: matchesExternalAlertmanager },
  {
    path: '/alerting/silence/:id/view',
    matches: (context) => matchesExternalAlertmanager(context) && Boolean(context.params.id),
  },
  {
    path: '/alerting/silence/:id/edit',
    matches: (context) => matchesExternalAlertmanager(context) && Boolean(context.params.id),
  },
] as const satisfies ReadonlyArray<{ path: string; matches: ProxyMatcher }>;

/** Every alerting route path the proxy table has an opinion about. */
export type ProxiedRoutePath = (typeof routeMatchers)[number]['path'];

const proxiedRoutePaths: ReadonlySet<string> = new Set(routeMatchers.map(({ path }) => path));

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
export function findRouteMatcher(routePath: string): ProxyMatcher | undefined {
  if (!proxiedRoutePaths.has(routePath)) {
    return undefined;
  }
  return routeMatchers.find(({ path }) => path === routePath)?.matches;
}
