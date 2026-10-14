/**
 * Requests to enter Composer from Grafana's own UI (the dashboard mode picker).
 *
 * Core cannot start a session itself: the Assistant plugin owns the chat and the presentation, and it only
 * holds the restricted `composer` API while its sidebar is mounted. So a request goes to the first
 * registered listener straight away, or waits (once, for at most `PENDING_REQUEST_TTL_MS`) for the first
 * listener to subscribe after the sidebar opens. Process-wide on purpose: there is one picker and one
 * plugin registration per page, and the API object it backs is a module singleton too.
 */

import { appEvents } from 'app/core/app_events';
import { SetExtensionSidebarPresentationEvent } from 'app/types/events';

import { type ComposerTarget } from './types';

type EnterRequestListener = (target: ComposerTarget) => void;

export const PENDING_REQUEST_TTL_MS = 10_000;

const listeners = new Set<EnterRequestListener>();
let pending: { target: ComposerTarget; at: number; timer: ReturnType<typeof setTimeout> } | undefined;
/**
 * A request that opened the Assistant sidebar straight into the floating presentation, so it never paints
 * docked first. Until a session starts for it, a failure, expiry or teardown docks the sidebar again so
 * the user is never left with an empty floating box.
 */
let floated: { target: ComposerTarget; timer: ReturnType<typeof setTimeout> } | undefined;

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
 * Asks Assistant to enter Composer on `target`: now if it is listening, else once it starts to. Pass
 * `floated` when the caller opened the sidebar in the floating presentation for this request.
 */
export function requestComposerEnter(target: ComposerTarget, { floated: didFloat = false } = {}): void {
  clearPendingComposerEnterRequest();
  if (didFloat) {
    floated = { target, timer: setTimeout(dockFloatedSidebar, PENDING_REQUEST_TTL_MS) };
  }
  const [listener] = listeners;
  if (listener) {
    listener(target);
    return;
  }
  pending = { target, at: Date.now(), timer: setTimeout(clearPendingComposerEnterRequest, PENDING_REQUEST_TTL_MS) };
}

/** Drops a request still waiting for a listener, so it never fires late (navigation, scene teardown). */
export function clearPendingComposerEnterRequest(): void {
  if (pending) {
    clearTimeout(pending.timer);
    pending = undefined;
  }
  dockFloatedSidebar();
}

/**
 * Reports how an entry attempt on `uid` ended. A session that started keeps the floating sidebar it was
 * requested with; a failed one docks it again.
 */
export function settleComposerEnterRequest(uid: string, outcome: 'entered' | 'failed'): void {
  if (!floated || floated.target.uid !== uid) {
    return;
  }
  if (outcome === 'failed') {
    dockFloatedSidebar();
    return;
  }
  clearTimeout(floated.timer);
  floated = undefined;
}

function dockFloatedSidebar(): void {
  if (floated) {
    clearTimeout(floated.timer);
    floated = undefined;
    appEvents.publish(new SetExtensionSidebarPresentationEvent({ presentation: 'docked' }));
  }
}

function takePendingRequest(): ComposerTarget | undefined {
  const waiting = pending;
  clearPendingComposerEnterRequest();
  return waiting && Date.now() - waiting.at <= PENDING_REQUEST_TTL_MS ? waiting.target : undefined;
}
