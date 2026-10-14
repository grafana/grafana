/**
 * Requests to enter Composer from Grafana's own UI (the dashboard mode picker).
 *
 * Core cannot start a session itself: the Assistant plugin owns the chat and the presentation, and it only
 * holds the restricted `composer` API while its sidebar is mounted. So a request goes to the first
 * registered listener straight away, or waits (once, for at most `PENDING_REQUEST_TTL_MS`) for the first
 * listener to subscribe after the sidebar opens. Process-wide on purpose: there is one picker and one
 * plugin registration per page, and the API object it backs is a module singleton too.
 */

import { claimFloatingExtensionSidebar } from 'app/core/components/AppChrome/ExtensionSidebar/extensionSidebarLayout';

import { type ComposerTarget } from './types';

type EnterRequestListener = (target: ComposerTarget) => void;

export const PENDING_REQUEST_TTL_MS = 10_000;

const listeners = new Set<EnterRequestListener>();
const changeListeners = new Set<() => void>();
/**
 * The request Composer has not settled yet: from the moment it is made until an entry attempt on it ends,
 * it is cleared, or `PENDING_REQUEST_TTL_MS` passes. What the UI that made it shows as pending.
 */
let outstanding: { target: ComposerTarget; timer: ReturnType<typeof setTimeout> } | undefined;
/** A request waiting for its first listener. */
let pending: { target: ComposerTarget; at: number } | undefined;
/**
 * A request that floats the extension sidebar until Composer takes over, so a sidebar the picker opens never
 * paints docked first. The session takes its own claim when it starts; a failure, expiry or teardown
 * releases this one, so the user is never left with an empty floating box. `docked` records that the user
 * docked the sidebar while it waited: the entry still goes ahead, docked.
 */
let floated: { target: ComposerTarget; release: () => void; docked: boolean } | undefined;

/**
 * Registers a listener for Composer entry requests and hands it a request still waiting for one.
 * Returns an unsubscribe.
 */
export function addComposerEnterRequestListener(listener: EnterRequestListener): () => void {
  listeners.add(listener);
  const waiting = takePendingRequest();
  if (waiting) {
    listener(waiting);
  }
  return () => {
    listeners.delete(listener);
  };
}

/**
 * Asks Assistant to enter Composer on `target`: now if it is listening, else once it starts to. With
 * `float`, the extension sidebar floats from now until the session takes over or the request ends.
 */
export function requestComposerEnter(target: ComposerTarget, { float = false } = {}): void {
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
  const [listener] = listeners;
  if (listener) {
    listener(target);
    return;
  }
  pending = { target, at: Date.now() };
}

/**
 * Ends the request still outstanding, so it never fires late, and releases its floating claim (navigation,
 * scene teardown, a newer request, expiry).
 */
export function clearPendingComposerEnterRequest(): void {
  const hadRequest = outstanding !== undefined;
  pending = undefined;
  releaseFloatedSidebar();
  dropOutstanding();
  if (hadRequest) {
    notifyChange();
  }
}

/** What the outstanding request is for: one waiting for a listener, or for its entry attempt to end. */
export function getPendingComposerEnterTarget(): ComposerTarget | undefined {
  return outstanding?.target;
}

/** Calls `listener` when a request starts or ends. Returns an unsubscribe. For `useSyncExternalStore`. */
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

function takePendingRequest(): ComposerTarget | undefined {
  const waiting = pending;
  // The listener now owns the request; it stays outstanding, and floating, until the entry attempt settles.
  pending = undefined;
  return waiting && Date.now() - waiting.at <= PENDING_REQUEST_TTL_MS ? waiting.target : undefined;
}
