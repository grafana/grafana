/**
 * Dispatched on `window` once a `GrafanaRoute` content boundary has committed to
 * the DOM — i.e. the route's lazily-loaded component (or its error page) has
 * rendered, not merely the Suspense loading fallback.
 *
 * The Faro/rrweb session replay backend listens for this to defer starting the
 * rrweb recorder until real route content exists, so the recorder's initial DOM
 * snapshot is taken against the rendered UI rather than a near-empty app.
 *
 * Guarantee: this fires when the first route-content boundary has committed, NOT
 * when the whole page (nested Suspense boundaries, async data, panels, plugins)
 * has fully settled.
 */
export const GRAFANA_ROUTE_CONTENT_READY_EVENT = 'grafana:route-content-ready';

export interface RouteContentReadyEventDetail {
  pathname: string;
  search: string;
  hash: string;
}
