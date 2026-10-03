import { isFetchError } from '@grafana/runtime';

/**
 * Whether this Grafana serves `.../notebooks/search` at all. The route is mounted from
 * `[grafana-apiserver] enable_search_api`, which is off by default and is not reported in
 * frontend settings, so the only way to find out is to ask and see.
 *
 * Module-level on purpose, and shared by every caller of the route: whether this deployment serves
 * it is a property of the deployment, not of one mount or one set of filters. RTK Query caches per
 * argument, so component state would also let every keystroke produce a fresh argument and
 * re-attempt a route that is already known to be absent. Delete this, and the LIST fallback in
 * `useNotebooksList`, once the endpoint is on everywhere.
 */
let searchUnavailable = false;

/**
 * Whether the route has ever answered, which is what makes a later 404 readable as transient rather
 * than as absence.
 */
let searchConfirmedAvailable = false;

export function isNotebookSearchUnavailable(): boolean {
  return searchUnavailable;
}

/** An answer for any query proves the route is served here, and that outlives the caller. */
export function confirmNotebookSearchAvailable(): void {
  searchConfirmedAvailable = true;
}

/**
 * Latches on the first "no such route" answer, so callers stop asking for the rest of the session.
 * Returns whether the failure meant absence, as opposed to a real error worth surfacing.
 *
 * An unmounted route parses as a request for a resource named "search", so it comes back as a 404;
 * 405 covers an apiserver that knows the path but not the verb. Once the route has answered, a 404
 * means something else — a deleted resource, or a proxy answering for it — and is a real error
 * rather than grounds for abandoning search.
 */
export function markNotebookSearchUnavailable(error: unknown): boolean {
  if (searchConfirmedAvailable || !isFetchError(error) || (error.status !== 404 && error.status !== 405)) {
    return false;
  }
  searchUnavailable = true;
  return true;
}

/** Test seam: the latches are module state, so they have to be resettable between cases. */
export function __resetSearchAvailabilityForTests(): void {
  searchUnavailable = false;
  searchConfirmedAvailable = false;
}
