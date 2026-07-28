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
 * re-reporting a stale value.
 *
 * Known acceptable edge case: if a profile is cancelled (e.g. the tab is hidden mid-load),
 * the slot survives uncommitted and the next completed interaction for that uid consumes
 * it late, attributing the fetch to the wrong interaction. Rare enough not to guard against.
 */

interface DashboardFetchTimingSlot {
  uid: string | undefined;
  durationMs: number;
}

let lastFetchTiming: DashboardFetchTimingSlot | undefined;

/**
 * Records the duration of a dashboard definition fetch. `uid` should be undefined when
 * the fetch was made before the uid was known (e.g. slug-based routes) so the consumer can
 * still match it up.
 */
export function recordDashboardFetchTiming(uid: string | undefined, durationMs: number): void {
  lastFetchTiming = { uid, durationMs };
}

/**
 * Consumes the last recorded fetch duration if it applies to `uid`, clearing the slot on a
 * match so subsequent calls return undefined until the next fetch is recorded. A stored uid
 * of undefined matches any request. On a uid mismatch (or empty slot), returns undefined and
 * leaves the slot untouched.
 */
export function consumeDashboardFetchTiming(uid: string): number | undefined {
  if (!lastFetchTiming) {
    return undefined;
  }

  if (lastFetchTiming.uid !== undefined && lastFetchTiming.uid !== uid) {
    return undefined;
  }

  const { durationMs } = lastFetchTiming;
  lastFetchTiming = undefined;
  return durationMs;
}
