/**
 * Which alerting routes the proxy has an opinion about — nothing more.
 *
 * The alerting route table imports this while the app is starting up, so it is the one piece of
 * the proxy that ends up in the first bundle the browser downloads. It is deliberately just a list
 * of strings with no imports at all; working out whether a given URL actually belongs to the
 * plugin, and where in it, lives in `proxies.ts`, which is fetched on demand.
 *
 * Paths must be character-for-character the ones in `getAlertingRoutes()` — `routes.test.tsx`
 * checks that. `proxies.ts` is typed against this list, so a path without a matcher and a handler
 * is a compile error rather than a route that quietly stops being proxied.
 */
export const PROXIED_ROUTE_PATHS = [
  // Rule pages
  '/alerting/:sourceName/:id/view',
  '/alerting/:sourceName/:name/find',
  '/alerting/:id/edit',
  '/alerting/new/:type?',

  // Rule group pages
  '/alerting/:dataSourceUid/namespaces/:namespaceId/groups/:groupName/view',
  '/alerting/:dataSourceUid/namespaces/:namespaceId/groups/:groupName/edit',

  // Alertmanager pages
  '/alerting/groups/',
  '/alerting/notifications',
  '/alerting/notifications/global-config',
  '/alerting/notifications/receivers/new',
  '/alerting/notifications/receivers/:name/edit',
  '/alerting/notifications/templates',
  '/alerting/notifications/templates/*',
  '/alerting/routes',
  '/alerting/routes/policy/:name/edit',
  '/alerting/routes/mute-timing',
  '/alerting/routes/mute-timing/new',
  '/alerting/routes/mute-timing/edit',
  '/alerting/silences',
  '/alerting/silence/new',
  '/alerting/silence/:id/view',
  '/alerting/silence/:id/edit',
] as const;

/** Every alerting route path the proxy table has an opinion about. */
export type ProxiedRoutePath = (typeof PROXIED_ROUTE_PATHS)[number];

const proxiedRoutePaths: ReadonlySet<string> = new Set(PROXIED_ROUTE_PATHS);

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
export function isProxiedRoutePath(routePath: string): routePath is ProxiedRoutePath {
  return proxiedRoutePaths.has(routePath);
}
