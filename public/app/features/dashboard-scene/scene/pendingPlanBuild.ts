/**
 * A plan building screen that the plan preview is navigating to /dashboard/new to show. The new
 * scene takes it on activation, before its first render, so it opens straight onto the loading
 * screen instead of showing the empty-dashboard state until RENDER_PLAN runs.
 *
 * Kept in memory rather than in the URL, so reloading the page never reopens a loading screen
 * that nothing will end.
 */
interface PendingPlanBuild {
  planId: string;
  planTitle: string;
}

let pending: PendingPlanBuild | undefined;

export function setPendingPlanBuild(next: PendingPlanBuild | undefined): void {
  pending = next;
}

/** Returns the pending building screen, if any, and clears it so it is taken at most once. */
export function takePendingPlanBuild(): PendingPlanBuild | undefined {
  const taken = pending;
  pending = undefined;
  return taken;
}
