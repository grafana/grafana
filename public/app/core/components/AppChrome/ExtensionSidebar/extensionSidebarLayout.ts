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

function supportsFloating(pluginId: string | undefined): boolean {
  return pluginId !== undefined && FLOATING_EXTENSION_SIDEBAR_PLUGINS.includes(pluginId);
}

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
 * Whether the user may dock the sidebar on the left or at the bottom, move it from the Chat button's menu, and pop
 * it up: `grafana.extensionSidebarPlacements`, on top of floating's flag, which the other edges need.
 */
export function canPlaceExtensionSidebar(): boolean {
  return (
    canFloatExtensionSidebar() &&
    getFeatureFlagClient().getBooleanValue(FlagKeys.GrafanaExtensionSidebarPlacements, false)
  );
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
  return supportsFloating(pluginId) && (floatingOverridden || (canFloat && requestedPresentation === 'floating'))
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

/**
 * Which edge of the page content the docked sidebar sits on. `left` puts it between the nav and the page, and
 * `bottom` below the page, past the nav. Both need `canPlaceExtensionSidebar()`.
 */
export type ExtensionSidebarDockSide = 'left' | 'right' | 'bottom';

const DOCK_SIDE_LOCAL_STORAGE_KEY = 'grafana.navigation.extensionSidebarDockSide';

let requestedDockSide: ExtensionSidebarDockSide | undefined;

function loadRequestedDockSide(): ExtensionSidebarDockSide {
  try {
    const stored = store.get(DOCK_SIDE_LOCAL_STORAGE_KEY);
    return stored === 'left' || stored === 'bottom' ? stored : 'right';
  } catch {
    // Blocked storage throws on access; dock where the sidebar always docked.
    return 'right';
  }
}

/** The side the user last docked the sidebar on, before the feature flag applies. */
export function getRequestedExtensionSidebarDockSide(): ExtensionSidebarDockSide {
  requestedDockSide ??= loadRequestedDockSide();
  return requestedDockSide;
}

/**
 * The side `pluginId`'s docked sidebar shows on: the requested one while placements are allowed, for a plugin that
 * supports floating; else the right. Any other plugin has no drag handle to move it back with.
 */
export function resolveExtensionSidebarDockSide(
  requestedSide: ExtensionSidebarDockSide,
  canPlace: boolean,
  pluginId: string | undefined
): ExtensionSidebarDockSide {
  return canPlace && supportsFloating(pluginId) ? requestedSide : 'right';
}

/** Sets the side the sidebar docks on, for every page; the next dock, by drag or by the extension, uses it. */
export function setExtensionSidebarDockSide(side: ExtensionSidebarDockSide): void {
  const from = getRequestedExtensionSidebarDockSide();
  if (side === from) {
    return;
  }
  requestedDockSide = side;
  try {
    store.set(DOCK_SIDE_LOCAL_STORAGE_KEY, side);
  } catch {
    // Kept for this page load only.
  }
  reportInteraction('grafana_extension_sidebar_dock_side_changed', { from, to: side });
  notify();
}

/** Where the open sidebar shows: docked on an edge of the page, or floating over it. */
export type ExtensionSidebarPlacement = ExtensionSidebarDockSide | 'floating';

/**
 * Where `pluginId`'s sidebar shows, or opens while it is closed. The one place the presentation and the dock side
 * combine, for core's own controls and the extension's alike.
 */
export function getExtensionSidebarPlacement(pluginId: string | undefined): ExtensionSidebarPlacement {
  if (getEffectiveExtensionSidebarPresentation(pluginId) === 'floating') {
    return 'floating';
  }
  return resolveExtensionSidebarDockSide(getRequestedExtensionSidebarDockSide(), canPlaceExtensionSidebar(), pluginId);
}

/**
 * Where the sidebar of an extension that supports floating shows: what the restricted API reports, since only such
 * an extension has controls that move it. Any other always docks on the right.
 */
export function getFloatingExtensionSidebarPlacement(): ExtensionSidebarPlacement {
  return getExtensionSidebarPlacement(FLOATING_EXTENSION_SIDEBAR_PLUGINS[0]);
}

/** Moves the sidebar, for every page: floating over the page, or docked on that edge. */
export function setExtensionSidebarPlacement(placement: ExtensionSidebarPlacement): void {
  if (placement === 'floating') {
    setExtensionSidebarPresentation('floating');
    return;
  }
  // The side first, so the sidebar never shows docked on the other one.
  setExtensionSidebarDockSide(placement);
  setExtensionSidebarPresentation('docked');
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

/**
 * Asks the floating sidebar's extension to collapse: `drag` when the user dragged the sidebar to the bottom edge,
 * `resize` when they let go of its height near the extension's collapsed height.
 */
export function collapseFloatingExtensionSidebar(method: 'drag' | 'resize' = 'drag'): void {
  collapseListeners.forEach((listener) => listener());
  reportInteraction('grafana_extension_sidebar_floating_collapsed', { method });
}

/** The heights the floating sidebar's extension lets core resize it between; see `setFloatingHeightResize`. */
export interface FloatingExtensionSidebarHeightOptions {
  minHeight: number;
  collapsedHeight?: number;
}

/**
 * The height resize the extension asked for, or `null` while it asks for none: core then shows no top or corner
 * handle and leaves the height to the extension. Module state for the same reason as the layout.
 */
let floatingHeightOptions: FloatingExtensionSidebarHeightOptions | null = null;

/** Sets the height resize the extension asked for. A call that changes nothing notifies no one. */
export function setFloatingExtensionSidebarHeightOptions(options: FloatingExtensionSidebarHeightOptions | null): void {
  // The extension calls this whenever its surface resizes, which a resize itself does.
  if (
    options?.minHeight === floatingHeightOptions?.minHeight &&
    options?.collapsedHeight === floatingHeightOptions?.collapsedHeight
  ) {
    return;
  }
  floatingHeightOptions = options;
  notify();
}

/** The height resize the extension asked for. Subscribe with `subscribeToExtensionSidebarPresentation`. */
export function getFloatingExtensionSidebarHeightOptions(): FloatingExtensionSidebarHeightOptions | null {
  return floatingHeightOptions;
}

/**
 * Who opens the sidebar's extension in a window of its own when the user asks to. The extension listens for the
 * page's lifetime, while its browser can open such a window. Module state for the same reason as the layout.
 */
const popOutListeners = new Set<() => void>();

/** Subscribes to requests to open the sidebar's extension in a new window; returns the unsubscribe. */
export function subscribeToExtensionSidebarPopOut(listener: () => void): () => void {
  popOutListeners.add(listener);
  return () => {
    popOutListeners.delete(listener);
  };
}

/** Whether the sidebar's extension can open in a new window: something listens for the request. */
export function canPopOutExtensionSidebar(): boolean {
  return popOutListeners.size > 0;
}

/**
 * Asks the sidebar's extension to open in a new window. Call it from the user's click, before anything awaits:
 * the browser opens the window only during the click.
 */
export function popOutExtensionSidebar(): void {
  popOutListeners.forEach((listener) => listener());
}

/** Brings the sidebar back from its own window, while it shows in one. Module state for the same reason. */
let popIn: (() => void) | undefined;

/**
 * Marks the sidebar's extension as shown in a window of its own until the returned function is called. Core's
 * controls then mark it there, and call `onPopIn` first when the user moves it from them, to bring it back.
 */
export function trackExtensionSidebarPopOut(onPopIn: () => void): () => void {
  popIn = onPopIn;
  notify();
  return () => {
    if (popIn === onPopIn) {
      popIn = undefined;
      notify();
    }
  };
}

/** Whether the sidebar's extension shows in a window of its own. For `useSyncExternalStore`, with the layout's. */
export function isExtensionSidebarPoppedOut(): boolean {
  return popIn !== undefined;
}

/** Brings the sidebar's extension back from its own window, if it shows in one, before core moves it. */
export function popInExtensionSidebar(): void {
  popIn?.();
}

/** @internal Resets the layout between tests; `keepStorage` stands for a new page load. */
export function resetExtensionSidebarPresentationForTests({ keepStorage = false } = {}): void {
  requested = undefined;
  requestedDockSide = undefined;
  floatingOverride = false;
  if (!keepStorage) {
    store.delete(PRESENTATION_LOCAL_STORAGE_KEY);
    store.delete(LEGACY_PRESENTATION_LOCAL_STORAGE_KEY);
    store.delete(DOCK_SIDE_LOCAL_STORAGE_KEY);
  }
  floatingHolds.clear();
  listeners.clear();
  collapseListeners.clear();
  floatingHeightOptions = null;
  popOutListeners.clear();
  popIn = undefined;
  closeListeners.clear();
}
