import { store } from '@grafana/data';
import { reportInteraction } from '@grafana/runtime';
import { FlagKeys, getFeatureFlagClient } from '@grafana/runtime/internal';

/**
 * How the open extension sidebar is laid out: `docked` as a column next to the page, or `floating` over the
 * page at its bottom centre. The same container and extension instance render in both, so switching
 * never remounts the extension.
 */
export type ExtensionSidebarPresentation = 'docked' | 'floating';

/** The sidebar floats until the user picks a layout; the pick then holds on every page. */
const DEFAULT_PRESENTATION: ExtensionSidebarPresentation = 'floating';

const PRESENTATION_LOCAL_STORAGE_KEY = 'grafana.navigation.extensionSidebarPresentation';
/**
 * Where the layout was remembered per kind of page (dashboards and notebooks, everything else). Read once, so a
 * user who floated it on either kind keeps floating; removed with the first pick.
 */
const LEGACY_PRESENTATION_LOCAL_STORAGE_KEY = 'grafana.navigation.extensionSidebarPresentationBySurface';

/**
 * Plugins that draw their own floating surface and drag handle, and can dock again through the restricted
 * `extensionSidebar` API. Any other sidebar plugin always docks.
 */
const FLOATING_EXTENSION_SIDEBAR_PLUGINS = ['grafana-assistant-app'];

/**
 * Two inputs decide the layout:
 * - the layout the user asked for, the same on every page, through the restricted `extensionSidebar` API.
 *   Floating only applies while `grafana.extensionSidebarFloating` is on.
 * - an override that floats the sidebar for a while whatever the user asked for, such as a Composer session.
 *   It does not need the flag. Turning it off brings the user's layout back.
 * Either way, only a plugin that supports floating floats. `ExtensionSidebarContextProvider` resolves the
 * effective layout.
 *
 * Module state on purpose: there is one extension sidebar per page, and plugins reach it only through the
 * restricted API, not an app event any plugin could publish. The requested layout is loaded lazily from local
 * storage; the override is never persisted, since whatever turned it on is gone after a reload.
 */
let requested: ExtensionSidebarPresentation | undefined;
let floatingOverride = false;
const listeners = new Set<() => void>();
const closeListeners = new Set<() => void>();

function notify() {
  listeners.forEach((listener) => listener());
}

function isPresentation(value: unknown): value is ExtensionSidebarPresentation {
  return value === 'docked' || value === 'floating';
}

function loadRequested(): ExtensionSidebarPresentation {
  const stored = store.get(PRESENTATION_LOCAL_STORAGE_KEY);
  if (isPresentation(stored)) {
    return stored;
  }
  const legacy: unknown = store.getObject(LEGACY_PRESENTATION_LOCAL_STORAGE_KEY, {});
  const legacyPicks = legacy && typeof legacy === 'object' ? Object.values(legacy).filter(isPresentation) : [];
  // Floated on either kind of page: keep floating. Docked on every kind the user picked for: stay docked.
  if (legacyPicks.length > 0 && legacyPicks.every((pick) => pick === 'docked')) {
    return 'docked';
  }
  return DEFAULT_PRESENTATION;
}

/** Whether the user may float the extension sidebar. The override floats it regardless. */
export function canFloatExtensionSidebar(): boolean {
  return getFeatureFlagClient().getBooleanValue(FlagKeys.GrafanaExtensionSidebarFloating, false);
}

/**
 * Sets the requested layout, for every page. Floating is ignored while `canFloatExtensionSidebar()` is false.
 * Docking also turns the override off: the user's choice wins, and whatever turned it on carries on docked.
 */
export function setExtensionSidebarPresentation(presentation: ExtensionSidebarPresentation): void {
  if (presentation === 'floating' && !canFloatExtensionSidebar()) {
    return;
  }
  const endsOverride = presentation === 'docked' && floatingOverride;
  const from = getRequestedExtensionSidebarPresentation();
  if (presentation === from && !endsOverride) {
    return;
  }
  if (endsOverride) {
    floatingOverride = false;
  }
  if (presentation !== from) {
    requested = presentation;
    store.set(PRESENTATION_LOCAL_STORAGE_KEY, presentation);
    store.delete(LEGACY_PRESENTATION_LOCAL_STORAGE_KEY);
    reportInteraction('grafana_extension_sidebar_presentation_changed', { from, to: presentation });
  }
  notify();
}

/**
 * Floats the sidebar while on, until it is turned off or the user docks it. Turning it off brings back the
 * layout the user asked for: the one from before, or the last one they chose since.
 */
export function setExtensionSidebarFloatingOverride(on: boolean): void {
  if (floatingOverride !== on) {
    floatingOverride = on;
    notify();
  }
}

/** Whether the override floats the sidebar right now. Subscribe with `subscribeToExtensionSidebarPresentation`. */
export function isExtensionSidebarFloatingOverridden(): boolean {
  return floatingOverride;
}

/**
 * The layout `pluginId`'s sidebar shows on the current page, given the requested one: floating only for a plugin
 * that supports it, and then while the override is on or while the flag allows the requested floating.
 */
export function resolveExtensionSidebarPresentation(
  requestedPresentation: ExtensionSidebarPresentation,
  canFloat: boolean,
  pluginId: string | undefined,
  floatingOverridden = false
): ExtensionSidebarPresentation {
  const supportsFloating = pluginId !== undefined && FLOATING_EXTENSION_SIDEBAR_PLUGINS.includes(pluginId);
  return supportsFloating && (floatingOverridden || (canFloat && requestedPresentation === 'floating'))
    ? 'floating'
    : 'docked';
}

/** The layout `pluginId`'s sidebar shows on the current page. */
export function getEffectiveExtensionSidebarPresentation(pluginId: string | undefined): ExtensionSidebarPresentation {
  return resolveExtensionSidebarPresentation(
    getRequestedExtensionSidebarPresentation(),
    canFloatExtensionSidebar(),
    pluginId,
    isExtensionSidebarFloatingOverridden()
  );
}

/** The requested layout, before the feature flag and the override apply. */
export function getRequestedExtensionSidebarPresentation(): ExtensionSidebarPresentation {
  requested ??= loadRequested();
  return requested;
}

/** For `useSyncExternalStore`. */
export function subscribeToExtensionSidebarPresentation(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
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

/**
 * Holds on the floating sidebar: while any is held, a floating sidebar stays mounted but hidden. A page that
 * offers its own Assistant prompt holds it until the prompt is submitted, so the page does not show two inputs
 * for the same thing. Any request to open the sidebar releases every hold, so the user opening it, or the page
 * handing its prompt over, shows it. Module state for the same reason as the layout: one sidebar per page.
 */
const floatingHolds = new Set<symbol>();

/** Holds the floating sidebar hidden; returns the release. */
export function holdFloatingExtensionSidebar(): () => void {
  const hold = Symbol('floating-extension-sidebar-hold');
  floatingHolds.add(hold);
  listeners.forEach((listener) => listener());
  return () => {
    if (floatingHolds.delete(hold)) {
      listeners.forEach((listener) => listener());
    }
  };
}

/** Releases every hold, when something asks to open the sidebar. */
export function releaseFloatingExtensionSidebarHolds(): void {
  if (floatingHolds.size > 0) {
    floatingHolds.clear();
    listeners.forEach((listener) => listener());
  }
}

/** Whether a floating sidebar is held hidden. Subscribe with `subscribeToExtensionSidebarPresentation`. */
export function isFloatingExtensionSidebarHeld(): boolean {
  return floatingHolds.size > 0;
}

/** Who wants to hear that the user asked to collapse the floating sidebar. Module state for the same reason. */
const collapseListeners = new Set<() => void>();

/** Subscribes to requests to collapse the floating sidebar; returns the unsubscribe. */
export function subscribeToFloatingExtensionSidebarCollapse(listener: () => void): () => void {
  collapseListeners.add(listener);
  return () => {
    collapseListeners.delete(listener);
  };
}

/** Whether anything listens for collapse requests; extensions listen only while there is something to collapse. */
export function canCollapseFloatingExtensionSidebar(): boolean {
  return collapseListeners.size > 0;
}

/** Asks the floating sidebar's extension to collapse. */
export function collapseFloatingExtensionSidebar(): void {
  collapseListeners.forEach((listener) => listener());
  reportInteraction('grafana_extension_sidebar_floating_collapsed', { method: 'drag' });
}

/** @internal Resets the layout between tests; `keepStorage` stands for a new page load. */
export function resetExtensionSidebarPresentationForTests({ keepStorage = false } = {}): void {
  requested = undefined;
  floatingOverride = false;
  if (!keepStorage) {
    store.delete(PRESENTATION_LOCAL_STORAGE_KEY);
    store.delete(LEGACY_PRESENTATION_LOCAL_STORAGE_KEY);
  }
  floatingHolds.clear();
  listeners.clear();
  collapseListeners.clear();
}
