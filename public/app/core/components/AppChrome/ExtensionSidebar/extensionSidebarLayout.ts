import { FlagKeys, getFeatureFlagClient } from '@grafana/runtime/internal';

/**
 * How the open extension sidebar is laid out: `docked` as a column next to the page, or `floating` over the
 * page in its bottom-right corner. The same container and extension instance render in both, so switching
 * never remounts the extension.
 */
export type ExtensionSidebarPresentation = 'docked' | 'floating';

/**
 * The layout the user asked for, through the restricted `extensionSidebar` API. Floating only applies while
 * `grafana.extensionSidebarFloating` is on; `ExtensionSidebarContextProvider` resolves the effective layout.
 *
 * Module state on purpose: there is one extension sidebar per page, and plugins reach it only through the
 * restricted API, not an app event any plugin could publish. Never persisted.
 */
let requested: ExtensionSidebarPresentation = 'docked';
const listeners = new Set<() => void>();

/** Whether the extension sidebar may float. */
export function canFloatExtensionSidebar(): boolean {
  return getFeatureFlagClient().getBooleanValue(FlagKeys.GrafanaExtensionSidebarFloating, false);
}

/** Sets the requested layout. Floating is ignored while `canFloatExtensionSidebar()` is false. */
export function setExtensionSidebarPresentation(presentation: ExtensionSidebarPresentation): void {
  if (presentation === 'floating' && !canFloatExtensionSidebar()) {
    return;
  }
  if (presentation === requested) {
    return;
  }
  requested = presentation;
  listeners.forEach((listener) => listener());
}

/** The requested layout, before the feature flag applies. */
export function getRequestedExtensionSidebarPresentation(): ExtensionSidebarPresentation {
  return requested;
}

/** For `useSyncExternalStore`. */
export function subscribeToExtensionSidebarPresentation(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** @internal Resets the layout between tests. */
export function resetExtensionSidebarPresentationForTests(): void {
  requested = 'docked';
  listeners.clear();
}
