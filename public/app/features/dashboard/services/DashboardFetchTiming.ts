/**
 * Tracks how long the most recent dashboard definition fetch took.
 *
 * dashboard_view/dashboard_render profiling starts only after the dashboard definition
 * has resolved (see DashboardScenePageStateManager.loadScene), so fetch time is otherwise
 * invisible in that profile. This module bridges the gap: the state manager records the
 * fetch duration here, and DashboardAnalyticsAggregator consumes it back when building the
 * dashboard_render payload.
 *
 * The fetch duration belongs only to the dashboard_render event that actually loaded the
 * definition - consuming it clears the slot so later interactions on the same dashboard
 * (refresh, time_range_change, ...) correctly omit dashboardFetchDuration instead of
 * re-reporting a stale value. A slow refetch can also resolve after its triggering profile
 * has already completed; consumeDashboardFetchTiming's `notBefore` guard drops timings that
 * are too old to belong to the interaction being reported, rather than letting them get
 * misattributed to whichever interaction happens to consume them next.
 */

export const FETCH_ATTRIBUTION_MAX_LEAD_MS = 5000;

interface DashboardFetchTimingSlot {
  uid: string | undefined;
  durationMs: number;
  recordedAt: number;
}

let lastFetchTiming: DashboardFetchTimingSlot | undefined;

/**
 * Records the duration of a dashboard definition fetch. `uid` should be undefined when
 * the fetch was made before the uid was known (e.g. slug-based routes) so the consumer can
 * still match it up.
 */
export function recordDashboardFetchTiming(uid: string | undefined, durationMs: number): void {
  lastFetchTiming = { uid, durationMs, recordedAt: performance.now() };
}

/**
 * Consumes the last recorded fetch duration if it applies to `uid`, clearing the slot on a
 * match so subsequent calls return undefined until the next fetch is recorded. A stored uid
 * of undefined matches any request. On a uid mismatch (or empty slot), returns undefined and
 * leaves the slot untouched.
 *
 * `notBefore`, when given, rejects (and discards) a timing recorded earlier than that instant.
 * The initial-load fetch legitimately completes before the interaction's profile starts (scene
 * transform work sits in between), so callers should pass a `notBefore` a little earlier than
 * their profile's start - see FETCH_ATTRIBUTION_MAX_LEAD_MS. Anything older than that is a fetch
 * from an abandoned or cancelled load and gets dropped rather than misattributed to whatever
 * interaction consumes it next.
 */
export function consumeDashboardFetchTiming(uid: string, notBefore?: number): number | undefined {
  if (!lastFetchTiming) {
    return undefined;
  }

  if (lastFetchTiming.uid !== undefined && lastFetchTiming.uid !== uid) {
    return undefined;
  }

  const { durationMs, recordedAt } = lastFetchTiming;
  lastFetchTiming = undefined;

  if (notBefore !== undefined && recordedAt < notBefore) {
    return undefined;
  }

  return durationMs;
}
