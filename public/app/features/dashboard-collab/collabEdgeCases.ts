/**
 * collabEdgeCases — utility functions for collaboration edge case handling.
 *
 * 1. Tab visibility: pause/resume cursor sending when tab is hidden/visible
 * 2. Large dashboard throttle: detect >50 panels, throttle op extraction
 * 3. Stale lock detection: warn when a lock is held >5min with no ops
 * 4. Channel error classification: detect deleted dashboard, permission revoked
 */

import { debugLog } from './debugLog';

/** Stale lock threshold: 5 minutes in milliseconds. */
export const STALE_LOCK_THRESHOLD_MS = 5 * 60 * 1000;

/** Panel count threshold for op extraction throttling. */
export const LARGE_DASHBOARD_PANEL_THRESHOLD = 50;

/** Op extraction throttle interval for large dashboards (ms). */
export const LARGE_DASHBOARD_THROTTLE_MS = 500;

/**
 * Returns true if the document is currently hidden (tab inactive).
 * Falls back to false if the Page Visibility API is unavailable.
 */
export function isTabHidden(): boolean {
  return typeof document !== 'undefined' && document.visibilityState === 'hidden';
}

/**
 * Subscribes to page visibility changes. Returns an unsubscribe function.
 */
export function onVisibilityChange(callback: (hidden: boolean) => void): () => void {
  if (typeof document === 'undefined') {
    return () => {};
  }
  const handler = () => {
    const hidden = document.visibilityState === 'hidden';
    debugLog('Tab visibility changed', { hidden });
    callback(hidden);
  };
  document.addEventListener('visibilitychange', handler);
  return () => document.removeEventListener('visibilitychange', handler);
}

/**
 * Checks if a lock is stale (held for longer than STALE_LOCK_THRESHOLD_MS
 * with no operations from the holder).
 */
export function isLockStale(lockAcquiredAt: number, lastOpByHolder: number | undefined, now: number): boolean {
  const referenceTime = lastOpByHolder ?? lockAcquiredAt;
  const stale = now - referenceTime > STALE_LOCK_THRESHOLD_MS;
  if (stale) {
    debugLog('Stale lock detected', { lockAcquiredAt, lastOpByHolder, ageMs: now - referenceTime });
  }
  return stale;
}

/** Error codes that indicate specific channel failures. */
export const CHANNEL_ERROR_DASHBOARD_DELETED = 'dashboard_deleted';
export const CHANNEL_ERROR_PERMISSION_DENIED = 'permission_denied';

/**
 * Classifies a channel error into a known edge case type, or returns null
 * if the error is generic/unknown.
 */
export function classifyChannelError(error: unknown): string | null {
  if (!error || typeof error !== 'object') {
    debugLog('Channel error classification: not an object', { error });
    return null;
  }

  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
  const err = error as { status?: number; message?: string; data?: { message?: string } };

  // 404 or "not found" → dashboard was deleted
  if (err.status === 404 || err.message?.toLowerCase().includes('not found')) {
    debugLog('Channel error classified as dashboard_deleted', { status: err.status, message: err.message });
    return CHANNEL_ERROR_DASHBOARD_DELETED;
  }

  // 403 or "forbidden"/"unauthorized" → permission revoked
  if (
    err.status === 403 ||
    err.status === 401 ||
    err.message?.toLowerCase().includes('forbidden') ||
    err.message?.toLowerCase().includes('unauthorized')
  ) {
    debugLog('Channel error classified as permission_denied', { status: err.status, message: err.message });
    return CHANNEL_ERROR_PERMISSION_DENIED;
  }

  debugLog('Channel error unclassified', { status: err.status, message: err.message });
  return null;
}

/**
 * Counts VizPanel instances in the scene tree (approximate).
 * Used to decide whether to enable op extraction throttling.
 */
export function countPanels(scene: { state: { body?: { state?: { children?: unknown[] } } } }): number {
  try {
    const body = scene.state.body;
    if (!body || !body.state || !Array.isArray(body.state.children)) {
      return 0;
    }
    const count = body.state.children.length;
    debugLog('Large dashboard detection: panel count', { count, threshold: LARGE_DASHBOARD_PANEL_THRESHOLD, isLarge: count > LARGE_DASHBOARD_PANEL_THRESHOLD });
    return count;
  } catch {
    return 0;
  }
}
