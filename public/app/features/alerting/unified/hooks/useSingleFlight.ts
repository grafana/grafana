import { useRef } from 'react';

/**
 * Wraps an async action so a second invocation is dropped while the first is still running.
 *
 * Needed for `ConfirmModal`, which submits through react-hook-form: `handleSubmit` awaits validation
 * before invoking the callback, so `onConfirm` runs a microtask after the click handler returns — by
 * which point a second click is already queued. A state-based guard cannot catch this (including
 * `ConfirmModal`'s own in-flight lock), because it has not re-rendered the button as disabled yet.
 */
export function useSingleFlight(action: () => Promise<void>) {
  const inFlightRef = useRef(false);

  return async () => {
    if (inFlightRef.current) {
      return;
    }
    inFlightRef.current = true;

    try {
      await action();
    } finally {
      inFlightRef.current = false;
    }
  };
}
