/**
 * Requests to enter Composer from Grafana's own UI (the dashboard mode picker, the notebook mode switch).
 *
 * Core cannot start a session itself: the Assistant plugin owns the chat and the presentation. Its listeners
 * say which document types they enter Composer on, and Grafana offers Composer only for those: a request
 * goes straight to the first listener that supports its resource, and a request nobody supports is never
 * made.
 *
 * Until Assistant first registers in this page lifetime (a fresh load with its sidebar closed: it registers
 * only once one of its roots has mounted), Grafana assumes dashboards when Assistant can have the `composer`
 * API at all, and holds a dashboard request for up to `PENDING_REQUEST_TTL_MS` while the sidebar it opens
 * loads. The first listener to register gets it, once, if it supports dashboards; otherwise it is released.
 *
 * Process-wide on purpose: there is one picker and one plugin registration per page, and the API object it
 * backs is a module singleton too.
 */

import { config } from '@grafana/runtime';
import { setExtensionSidebarFloatingOverride } from 'app/core/components/AppChrome/ExtensionSidebar/extensionSidebarLayout';
import { ASSISTANT_PLUGIN_ID } from 'app/core/constants';

import { dashboardComposerEnabled } from '../scene/dashboardModes';

import { type ComposerEnterRequestOptions, type ComposerResource, type ComposerTarget } from './types';

/** Returns `false` to decline the request: it then ends at once, and goes to no other listener. */
type EnterRequestListener = (target: ComposerTarget) => boolean | void;

const COMPOSER_RESOURCES: readonly ComposerResource[] = ['dashboard', 'notebook'];
/** What a listener registered without options supports: the plugin then only knows dashboards. */
const DEFAULT_RESOURCES: readonly ComposerResource[] = ['dashboard'];
/** What Grafana assumes before Assistant first registers, when Assistant can have the `composer` API. */
const BEFORE_FIRST_REGISTRATION: readonly ComposerResource[] = ['dashboard'];
const NONE: readonly ComposerResource[] = [];

export const PENDING_REQUEST_TTL_MS = 10_000;

/** Each live listener with the document types it enters Composer on, in registration order. */
const listeners = new Map<EnterRequestListener, ReadonlySet<ComposerResource>>();
const changeListeners = new Set<() => void>();
/** The union of the listeners' resources, kept as one array between changes for `useSyncExternalStore`. */
let supported: readonly ComposerResource[] = NONE;
/**
 * Whether any listener has registered in this page lifetime. From then on only the declared resources count:
 * once every listener has unsubscribed, nothing is supported, and Grafana does not go back to assuming
 * dashboards. Assistant registered, so it knows what it supports, and its silence means none.
 */
let registered = false;
/** A dashboard request made before Assistant first registered, held for the first listener (see above). */
let held: { target: ComposerTarget; at: number } | undefined;
/**
 * The request Composer has not settled yet: from the moment it is made until an entry attempt on it ends,
 * it is cleared, or `PENDING_REQUEST_TTL_MS` passes. What the UI that made it shows as pending.
 */
let outstanding: { target: ComposerTarget; timer: ReturnType<typeof setTimeout> } | undefined;
/**
 * A request that floats the extension sidebar until Composer takes over, so a sidebar the picker opens never
 * paints docked first. A session that starts floating keeps the override on; a failure, expiry or teardown
 * turns it off, so the user is never left with an empty floating box. If the user docks the sidebar while it
 * waits, the override is off and the entry still goes ahead, docked.
 */
let floated: { target: ComposerTarget } | undefined;

/**
 * Registers a listener for Composer entry requests on the document types in `options.resources`, or on
 * dashboards when `options` is omitted. Returns an unsubscribe. To change the types, unsubscribe and register
 * again.
 */
export function addComposerEnterRequestListener(
  listener: EnterRequestListener,
  options?: ComposerEnterRequestOptions
): () => void {
  // Plugins call this from untyped code too: anything that is not a document type is ignored.
  const resources = options?.resources ?? DEFAULT_RESOURCES;
  const valid = Array.isArray(resources)
    ? resources.filter((resource): resource is ComposerResource => COMPOSER_RESOURCES.includes(resource))
    : [];
  const before = getSupportedComposerResources();
  listeners.delete(listener);
  listeners.set(listener, new Set(valid));
  registered = true;
  updateSupported(before);
  deliverHeldRequest(listener, new Set(valid));
  return () => {
    if (listeners.delete(listener)) {
      updateSupported(getSupportedComposerResources());
    }
  };
}

/**
 * The document types some listener enters Composer on, or, before Assistant first registers, the ones Grafana
 * assumes. Stable between changes.
 */
export function getSupportedComposerResources(): readonly ComposerResource[] {
  if (registered) {
    return supported;
  }
  return dashboardComposerEnabled() && canAssistantHaveComposerApi() ? BEFORE_FIRST_REGISTRATION : NONE;
}

/**
 * Asks Assistant to enter Composer on `target`, if a listener supports its resource; returns whether the
 * request stands (false when nobody supports it, or the listener declined it at once). With `float`, the
 * extension sidebar floats from now until the session takes over or the request ends.
 */
export function requestComposerEnter(target: ComposerTarget, { float = false } = {}): boolean {
  const listener = [...listeners].find(([, resources]) => resources.has(target.resource))?.[0];
  const hold = !listener && !registered && getSupportedComposerResources().includes(target.resource);
  if (!listener && !hold) {
    return false;
  }
  clearPendingComposerEnterRequest();
  outstanding = { target, timer: setTimeout(clearPendingComposerEnterRequest, PENDING_REQUEST_TTL_MS) };
  if (float) {
    floated = { target };
    setExtensionSidebarFloatingOverride(true);
  }
  notifyChange();
  if (!listener) {
    held = { target, at: Date.now() };
    return true;
  }
  return offer(listener, target);
}

/**
 * Ends the request still outstanding, so it never fires late, and stops floating the sidebar for it
 * (navigation, scene teardown, a newer request, expiry).
 */
export function clearPendingComposerEnterRequest(): void {
  const hadRequest = outstanding !== undefined;
  held = undefined;
  releaseFloatedSidebar();
  dropOutstanding();
  if (hadRequest) {
    notifyChange();
  }
}

/** What the outstanding request is for: one waiting for its entry attempt to end. */
export function getPendingComposerEnterTarget(): ComposerTarget | undefined {
  return outstanding?.target;
}

/**
 * Calls `listener` when a request starts or ends, or the supported document types change. Returns an
 * unsubscribe. For `useSyncExternalStore`.
 */
export function subscribeToComposerEnterRequests(listener: () => void): () => void {
  changeListeners.add(listener);
  return () => {
    changeListeners.delete(listener);
  };
}

/**
 * Ends the request on `uid` once an entry attempt on it is over. With `keepFloating`, a session started
 * floating and takes the override over, so the sidebar keeps floating; otherwise it goes back to the user's
 * layout.
 */
export function settleComposerEnterRequest(uid: string, { keepFloating = false } = {}): void {
  if (floated?.target.uid === uid) {
    if (keepFloating) {
      floated = undefined;
    } else {
      releaseFloatedSidebar();
    }
  }
  if (outstanding?.target.uid === uid) {
    dropOutstanding();
    notifyChange();
  }
}

function releaseFloatedSidebar(): void {
  if (floated) {
    floated = undefined;
    setExtensionSidebarFloatingOverride(false);
  }
}

function dropOutstanding(): void {
  if (outstanding) {
    clearTimeout(outstanding.timer);
    outstanding = undefined;
  }
}

function notifyChange(): void {
  [...changeListeners].forEach((listener) => listener());
}

function updateSupported(before: readonly ComposerResource[]): void {
  const union = COMPOSER_RESOURCES.filter((resource) =>
    [...listeners.values()].some((resources) => resources.has(resource))
  );
  if (union.length !== supported.length || union.some((resource, index) => resource !== supported[index])) {
    supported = union.length > 0 ? union : NONE;
  }
  const after = getSupportedComposerResources();
  if (after !== before) {
    notifyChange();
  }
}

/**
 * Hands the held request to the first listener to register, once. One that does not support its resource
 * releases it instead: the sidebar stops floating and the picker shows what the dashboard is in.
 */
function deliverHeldRequest(listener: EnterRequestListener, resources: ReadonlySet<ComposerResource>): void {
  const request = held;
  held = undefined;
  if (!request) {
    return;
  }
  if (!resources.has(request.target.resource) || Date.now() - request.at > PENDING_REQUEST_TTL_MS) {
    clearPendingComposerEnterRequest();
    return;
  }
  offer(listener, request.target);
}

/**
 * Hands `target` to `listener`. A listener that returns `false` declines it: the request ends at once (its
 * sidebar stops floating for it, and the picker or switch stops showing it pending) and is offered to nobody else.
 * Anything else leaves it outstanding until an entry attempt settles it or it expires. Returns whether the
 * request stands.
 */
function offer(listener: EnterRequestListener, target: ComposerTarget): boolean {
  if (listener(target) !== false) {
    return true;
  }
  if (outstanding?.target === target) {
    clearPendingComposerEnterRequest();
  }
  return false;
}

/**
 * Whether the `composer` API would be shared with Assistant, as RestrictedGrafanaApisProvider and
 * RestrictedGrafanaApisContextProvider decide: the allow list, or, without one, the block list. Whether
 * Assistant is enabled is the entry points' check: they need its sidebar component, which only an enabled
 * Assistant registers.
 */
function canAssistantHaveComposerApi(): boolean {
  const matches = (list: string[] | undefined) => Boolean(list?.includes(ASSISTANT_PLUGIN_ID));
  const { pluginRestrictedAPIsAllowList: allow, pluginRestrictedAPIsBlockList: block } = config.bootData.settings;
  if (allow && Object.keys(allow).length > 0) {
    return matches(allow.composer);
  }
  return Boolean(block?.composer) && !matches(block?.composer);
}

/** @internal Forgets listeners and the first registration between tests. */
export function resetComposerEnterRequestsForTests(): void {
  clearPendingComposerEnterRequest();
  listeners.clear();
  supported = NONE;
  registered = false;
}
