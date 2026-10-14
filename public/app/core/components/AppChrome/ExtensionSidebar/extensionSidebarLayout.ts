import { FlagKeys, getFeatureFlagClient } from '@grafana/runtime/internal';

/**
 * How the open extension sidebar is laid out: `docked` as a column next to the page, or `floating` over the
 * page in its bottom-right corner. The same container and extension instance render in both, so switching
 * never remounts the extension.
 */
export type ExtensionSidebarPresentation = 'docked' | 'floating';

interface FloatingClaim {
  /**
   * Called when the user docks the sidebar while the claim holds. The claim is already withdrawn: the
   * user's choice wins, and whatever took the claim carries on docked.
   */
  onDocked?: () => void;
}

/**
 * Two inputs decide the layout:
 * - the layout the user asked for, through the restricted `extensionSidebar` API. Floating only applies
 *   while `grafana.extensionSidebarFloating` is on.
 * - claims that float the sidebar for a while whatever the user asked for, such as a Composer session. They
 *   do not need the flag. Releasing the last one brings the user's layout back.
 * `ExtensionSidebarContextProvider` resolves the effective layout from both.
 *
 * Module state on purpose: there is one extension sidebar per page, and plugins reach it only through the
 * restricted API, not an app event any plugin could publish. Never persisted.
 */
let requested: ExtensionSidebarPresentation = 'docked';
const claims = new Set<FloatingClaim>();
const listeners = new Set<() => void>();
const closeListeners = new Set<() => void>();

function notify() {
  listeners.forEach((listener) => listener());
}

/** Whether the user may float the extension sidebar. Claims float it regardless. */
export function canFloatExtensionSidebar(): boolean {
  return getFeatureFlagClient().getBooleanValue(FlagKeys.GrafanaExtensionSidebarFloating, false);
}

/**
 * Sets the layout the user asked for. Floating is ignored while `canFloatExtensionSidebar()` is false.
 * Docking also withdraws every claim, calling its `onDocked`, so a docked sidebar never stays floated by one.
 */
export function setExtensionSidebarPresentation(presentation: ExtensionSidebarPresentation): void {
  if (presentation === 'floating' && !canFloatExtensionSidebar()) {
    return;
  }
  const ended = presentation === 'docked' ? [...claims] : [];
  if (presentation === requested && ended.length === 0) {
    return;
  }
  requested = presentation;
  ended.forEach((claim) => claims.delete(claim));
  notify();
  ended.forEach((claim) => claim.onDocked?.());
}

/**
 * Floats the sidebar until the returned release is called, or until the user docks it. Releasing brings back
 * the layout the user asked for: the one from before the claim, or the last one they chose since.
 */
export function claimFloatingExtensionSidebar(claim: FloatingClaim = {}): () => void {
  // A fresh entry, so the same options object can back two claims.
  const entry: FloatingClaim = { ...claim };
  claims.add(entry);
  notify();
  return () => {
    if (claims.delete(entry)) {
      notify();
    }
  };
}

/** The layout the user asked for, before the flag and the claims apply. */
export function getRequestedExtensionSidebarPresentation(): ExtensionSidebarPresentation {
  return requested;
}

/** Whether a claim floats the sidebar right now. */
export function isExtensionSidebarFloatingClaimed(): boolean {
  return claims.size > 0;
}

/** The effective layout: floating while claimed, or while the user asked for it and may float. */
export function getExtensionSidebarPresentation(): ExtensionSidebarPresentation {
  return isExtensionSidebarFloatingClaimed() || (requested === 'floating' && canFloatExtensionSidebar())
    ? 'floating'
    : 'docked';
}

/**
 * Calls `listener` whenever the open extension sidebar closes, or its component is replaced by another one.
 * Returns an unsubscribe. For whatever lives only while the sidebar shows, such as a Composer session.
 */
export function onExtensionSidebarClosed(listener: () => void): () => void {
  closeListeners.add(listener);
  return () => {
    closeListeners.delete(listener);
  };
}

/** @internal Called by `ExtensionSidebarContextProvider` when the open sidebar closes. */
export function notifyExtensionSidebarClosed(): void {
  [...closeListeners].forEach((listener) => listener());
}

/** For `useSyncExternalStore`. */
export function subscribeToExtensionSidebarPresentation(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** @internal Resets the layout between tests. Subscribers are not told: they belong to finished tests. */
export function resetExtensionSidebarPresentationForTests(): void {
  requested = 'docked';
  claims.clear();
}
