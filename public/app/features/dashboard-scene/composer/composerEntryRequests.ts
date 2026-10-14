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
let pending: { target: ComposerTarget; at: number; timer: ReturnType<typeof setTimeout> } | undefined;
/**
 * A request that floats the extension sidebar until Composer takes over, so a sidebar the picker opens never
 * paints docked first. The session takes its own claim when it starts; a failure, expiry or teardown
 * releases this one, so the user is never left with an empty floating box. `docked` records that the user
 * docked the sidebar while it waited: the entry still goes ahead, docked.
 */
let floated:
  | { target: ComposerTarget; release: () => void; timer: ReturnType<typeof setTimeout>; docked: boolean }
  | undefined;

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
  if (float) {
    const request = {
      target,
      release: claimFloatingExtensionSidebar({
        // The user's choice wins: the claim is gone, and the session this request starts stays docked.
        onDocked: () => {
          request.docked = true;
        },
      }),
      timer: setTimeout(releaseFloatedSidebar, PENDING_REQUEST_TTL_MS),
      docked: false,
    };
    floated = request;
  }
  const [listener] = listeners;
  if (listener) {
    listener(target);
    return;
  }
  pending = { target, at: Date.now(), timer: setTimeout(dropPendingRequest, PENDING_REQUEST_TTL_MS) };
}

/**
 * Drops a request still waiting for a listener, so it never fires late, and releases its floating claim
 * (navigation, scene teardown, a newer request).
 */
export function clearPendingComposerEnterRequest(): void {
  dropPendingRequest();
  releaseFloatedSidebar();
}

/** What a request still waiting (for a listener, or for its session to start) is for. */
export function getPendingComposerEnterTarget(): ComposerTarget | undefined {
  return pending?.target ?? floated?.target;
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
}

/** Whether the user docked the sidebar while the request on `uid` waited, so its session should not float. */
export function wasComposerEnterRequestDocked(uid: string): boolean {
  return floated?.target.uid === uid && floated.docked;
}

function releaseFloatedSidebar(): void {
  floated?.release();
  forgetFloated();
}

function forgetFloated(): void {
  if (floated) {
    clearTimeout(floated.timer);
    floated = undefined;
  }
}

function dropPendingRequest(): void {
  if (pending) {
    clearTimeout(pending.timer);
    pending = undefined;
  }
}

function takePendingRequest(): ComposerTarget | undefined {
  const waiting = pending;
  // The listener now owns the request; a floating claim stays until the entry attempt settles.
  dropPendingRequest();
  return waiting && Date.now() - waiting.at <= PENDING_REQUEST_TTL_MS ? waiting.target : undefined;
}
