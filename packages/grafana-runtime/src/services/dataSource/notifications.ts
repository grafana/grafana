import { AppEvents, type EventBus } from '@grafana/data';

import { getAppEvents } from '../appEvents';

// Plain strings: @grafana/runtime does not depend on @grafana/i18n.
const TITLE = 'Data sources failed to load';
const TEXT = 'Refresh the page to try again.';

let notified = false;

/**
 * Tell the user that the data source list failed to load. Shown once per run of failures, so a
 * retry that fails again does not stack toasts; the next successful fill resets it.
 */
export function notifyDataSourceLoadFailed(): void {
  if (notified) {
    return;
  }
  notified = true;
  try {
    // The app event bus is set at boot; without it there is nobody to show the toast to.
    const events: EventBus | undefined = getAppEvents();
    events?.publish({ type: AppEvents.alertError.name, payload: [TITLE, TEXT] });
  } catch {
    // A failed toast must not turn a load failure into a different failure.
  }
}

export function resetDataSourceLoadFailureNotice(): void {
  notified = false;
}

export function _resetForTests(): void {
  if (process.env.NODE_ENV !== 'test') {
    throw new Error('_resetForTests must only be called from tests');
  }
  notified = false;
}
