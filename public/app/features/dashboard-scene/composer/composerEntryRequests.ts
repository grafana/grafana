/**
 * Requests to enter Composer from Grafana's own UI (the dashboard mode picker, the notebook mode switch).
 *
 * Core cannot start a session itself: the Assistant plugin owns the chat and the presentation. Its listeners
 * say which document types they enter Composer on, and Grafana offers Composer only for those: a request
 * goes straight to the first listener that supports its resource, and a request nobody supports is never
 * made. Process-wide on purpose: there is one picker and one plugin registration per page, and the API
 * object it backs is a module singleton too.
 */

import { claimFloatingExtensionSidebar } from 'app/core/components/AppChrome/ExtensionSidebar/extensionSidebarLayout';

import { type ComposerEnterRequestOptions, type ComposerResource, type ComposerTarget } from './types';

type EnterRequestListener = (target: ComposerTarget) => void;

const COMPOSER_RESOURCES: readonly ComposerResource[] = ['dashboard', 'notebook'];
/** What a listener registered without options supports: the plugin then only knows dashboards. */
const DEFAULT_RESOURCES: readonly ComposerResource[] = ['dashboard'];

export const PENDING_REQUEST_TTL_MS = 10_000;

/** Each live listener with the document types it enters Composer on, in registration order. */
const listeners = new Map<EnterRequestListener, ReadonlySet<ComposerResource>>();
const changeListeners = new Set<() => void>();
/** The union of the listeners' resources, kept as one array between changes for `useSyncExternalStore`. */
let supported: readonly ComposerResource[] = [];
/**
 * The request Composer has not settled yet: from the moment it is made until an entry attempt on it ends,
 * it is cleared, or `PENDING_REQUEST_TTL_MS` passes. What the UI that made it shows as pending.
 */
let outstanding: { target: ComposerTarget; timer: ReturnType<typeof setTimeout> } | undefined;
/**
 * A request that floats the extension sidebar until Composer takes over, so a sidebar the picker opens never
 * paints docked first. The session takes its own claim when it starts; a failure, expiry or teardown
 * releases this one, so the user is never left with an empty floating box. `docked` records that the user
 * docked the sidebar while it waited: the entry still goes ahead, docked.
 */
let floated: { target: ComposerTarget; release: () => void; docked: boolean } | undefined;

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
  listeners.delete(listener);
  listeners.set(listener, new Set(valid));
  updateSupported();
  return () => {
    if (listeners.delete(listener)) {
      updateSupported();
    }
  };
}

/** The document types some listener enters Composer on. Stable between changes. */
export function getSupportedComposerResources(): readonly ComposerResource[] {
  return supported;
}

/**
 * Asks Assistant to enter Composer on `target`, if a listener supports its resource; returns whether it did.
 * With `float`, the extension sidebar floats from now until the session takes over or the request ends.
 */
export function requestComposerEnter(target: ComposerTarget, { float = false } = {}): boolean {
  const listener = [...listeners].find(([, resources]) => resources.has(target.resource))?.[0];
  if (!listener) {
    return false;
  }
  clearPendingComposerEnterRequest();
  outstanding = { target, timer: setTimeout(clearPendingComposerEnterRequest, PENDING_REQUEST_TTL_MS) };
  if (float) {
    const request = {
      target,
      release: claimFloatingExtensionSidebar({
        // The user's choice wins: the claim is gone, and the session this request starts stays docked.
        onDocked: () => {
          request.docked = true;
        },
      }),
      docked: false,
    };
    floated = request;
  }
  notifyChange();
  listener(target);
  return true;
}

/**
 * Ends the request still outstanding, so it never fires late, and releases its floating claim (navigation,
 * scene teardown, a newer request, expiry).
 */
export function clearPendingComposerEnterRequest(): void {
  const hadRequest = outstanding !== undefined;
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
 * Ends the request on `uid` once an entry attempt on it is over, releasing its floating claim. A session that
 * started holds its own claim by then, so the sidebar keeps floating; after a failure it goes back to the
 * user's layout.
 */
export function settleComposerEnterRequest(uid: string): void {
  if (floated?.target.uid === uid) {
    releaseFloatedSidebar();
  }
  if (outstanding?.target.uid === uid) {
    dropOutstanding();
    notifyChange();
  }
}

/** Whether the user docked the sidebar while the request on `uid` waited, so its session should not float. */
export function wasComposerEnterRequestDocked(uid: string): boolean {
  return floated?.target.uid === uid && floated.docked;
}

function releaseFloatedSidebar(): void {
  floated?.release();
  floated = undefined;
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

function updateSupported(): void {
  const union = COMPOSER_RESOURCES.filter((resource) =>
    [...listeners.values()].some((resources) => resources.has(resource))
  );
  if (union.length !== supported.length || union.some((resource, index) => resource !== supported[index])) {
    supported = union;
    notifyChange();
  }
}
