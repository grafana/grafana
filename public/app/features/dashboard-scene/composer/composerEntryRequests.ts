/**
 * Requests to enter Composer from Grafana's own UI (the dashboard mode picker).
 *
 * Core cannot start a session itself: the Assistant plugin owns the chat and the presentation, and it only
 * holds the restricted `composer` API while its sidebar is mounted. So a request goes to the first
 * registered listener straight away, or waits (once, for at most `PENDING_REQUEST_TTL_MS`) for the first
 * listener to subscribe after the sidebar opens. Process-wide on purpose: there is one picker and one
 * plugin registration per page, and the API object it backs is a module singleton too.
 */

import { type ComposerTarget } from './types';

type EnterRequestListener = (target: ComposerTarget) => void;

export const PENDING_REQUEST_TTL_MS = 10_000;

const listeners = new Set<EnterRequestListener>();
let pending: { target: ComposerTarget; at: number; timer: ReturnType<typeof setTimeout> } | undefined;

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

/** Asks Assistant to enter Composer on `target`: now if it is listening, else once it starts to. */
export function requestComposerEnter(target: ComposerTarget): void {
  clearPendingComposerEnterRequest();
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
}

function takePendingRequest(): ComposerTarget | undefined {
  const waiting = pending;
  clearPendingComposerEnterRequest();
  return waiting && Date.now() - waiting.at <= PENDING_REQUEST_TTL_MS ? waiting.target : undefined;
}
