/**
 * Everything a proxy gets to look at when deciding what to do with a URL.
 */
export interface ProxyContext {
  /**
   * The pathname exactly as the browser has it, with Grafana's sub path taken off the front.
   * Still percent-encoded.
   */
  pathname: string;
  /**
   * Path params, still percent-encoded, exactly as they appear in the URL. Decode before comparing
   * against anything, and don't build URLs straight out of them — see the warning in
   * `utils/rule-id.ts` about params not surviving a round trip.
   */
  params: Record<string, string | undefined>;
  searchParams: URLSearchParams;
}

/**
 * Does this URL belong to the plugin? Kept separate from `ProxyHandler`, and kept synchronous, so
 * that Grafana-managed pages render straight away instead of waiting on a plugin check they'll
 * never need. Every route can answer this from the URL alone.
 */
export type ProxyMatcher = (context: ProxyContext) => boolean;

/**
 * Builds the plugin URL to redirect to. Only called once the matcher has said yes and the plugin is
 * known to be installed, so it's free to look things up. Returns undefined if it can't build a URL
 * after all, in which case the page stays on Grafana's side.
 */
export type ProxyHandler = (context: ProxyContext) => Promise<string | undefined>;

export interface RouteProxy {
  /** Must be character-for-character one of the paths in `getAlertingRoutes()`. */
  path: string;
  matches: ProxyMatcher;
  handler: ProxyHandler;
}
