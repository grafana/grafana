/** Maximum wall-clock time to spend in Waiting before transitioning to Timeout. */
export const ST_POD_TIMEOUT_MS = 5 * 60 * 1000;

/** Delay between /api/health probes while Waiting. */
export const ST_POD_POLL_INTERVAL_MS = 10 * 1000;

/** How long a Ready status is trusted before the next read triggers re-verification. */
export const ST_POD_READY_TTL_MS = 60 * 60 * 1000;
