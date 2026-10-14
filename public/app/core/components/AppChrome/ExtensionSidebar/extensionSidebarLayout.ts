import { store } from '@grafana/data';
import { locationService } from '@grafana/runtime';
import { FlagKeys, getFeatureFlagClient } from '@grafana/runtime/internal';
import { NOTEBOOKS_BASE_URL } from 'app/features/notebook/urls';

/**
 * How the open extension sidebar is laid out: `docked` as a column next to the page, or `floating` over the
 * page at its bottom centre. The same container and extension instance render in both, so switching
 * never remounts the extension.
 */
export type ExtensionSidebarPresentation = 'docked' | 'floating';

/** Dashboards and notebooks favour the page, so the layout is remembered for them apart from other pages. */
type LayoutSurface = 'dashboardOrNotebook' | 'other';

const DEFAULT_PRESENTATION: Record<LayoutSurface, ExtensionSidebarPresentation> = {
  dashboardOrNotebook: 'floating',
  other: 'docked',
};

const PRESENTATION_LOCAL_STORAGE_KEY = 'grafana.navigation.extensionSidebarPresentationBySurface';

/**
 * The layout the user asked for per surface, through the restricted `extensionSidebar` API. Floating only applies
 * while `grafana.extensionSidebarFloating` is on; `ExtensionSidebarContextProvider` resolves the effective layout.
 *
 * Module state on purpose: there is one extension sidebar per page, and plugins reach it only through the
 * restricted API, not an app event any plugin could publish. Loaded lazily from local storage.
 */
let requested: Partial<Record<LayoutSurface, ExtensionSidebarPresentation>> | undefined;
const listeners = new Set<() => void>();

function getRequested(): Partial<Record<LayoutSurface, ExtensionSidebarPresentation>> {
  requested ??= store.getObject(PRESENTATION_LOCAL_STORAGE_KEY, {});
  return requested;
}

function getSurface(path: string): LayoutSurface {
  return path.startsWith('/d/') || path.startsWith('/dashboard/') || path.startsWith(`${NOTEBOOKS_BASE_URL}/`)
    ? 'dashboardOrNotebook'
    : 'other';
}

function currentPath(): string {
  return locationService.getLocation().pathname;
}

/** Whether the extension sidebar may float. */
export function canFloatExtensionSidebar(): boolean {
  return getFeatureFlagClient().getBooleanValue(FlagKeys.GrafanaExtensionSidebarFloating, false);
}

/** Sets the requested layout for the current page's surface. Floating is ignored while `canFloatExtensionSidebar()` is false. */
export function setExtensionSidebarPresentation(
  presentation: ExtensionSidebarPresentation,
  path: string = currentPath()
): void {
  if (presentation === 'floating' && !canFloatExtensionSidebar()) {
    return;
  }
  if (presentation === getRequestedExtensionSidebarPresentation(path)) {
    return;
  }
  requested = { ...getRequested(), [getSurface(path)]: presentation };
  store.set(PRESENTATION_LOCAL_STORAGE_KEY, JSON.stringify(requested));
  listeners.forEach((listener) => listener());
}

/** The requested layout for the current page, before the feature flag applies. */
export function getRequestedExtensionSidebarPresentation(path: string = currentPath()): ExtensionSidebarPresentation {
  const surface = getSurface(path);
  return getRequested()[surface] ?? DEFAULT_PRESENTATION[surface];
}

/** For `useSyncExternalStore`; the provider re-renders on navigation, which re-reads the snapshot for the new page. */
export function subscribeToExtensionSidebarPresentation(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** @internal Resets the layout between tests. */
export function resetExtensionSidebarPresentationForTests(): void {
  requested = {};
  listeners.clear();
}
