import { AppEvents, type RawTimeRange } from '@grafana/data';
import { t } from '@grafana/i18n';
import { type NotebookElement } from '@grafana/schema/apis/notebook/v2beta1';
import { appEvents } from 'app/core/app_events';

import { clearLastUsedNotebook, getLastUsedNotebook } from '../model/lastUsedNotebook';

import { addElementToNotebook } from './addToNotebook';

/**
 * One-click "Add to last notebook": appends the element to the most recently used
 * notebook without going through the picker modal. Returns false when there is no
 * usable last notebook (callers should fall back to the full add-to-notebook flow).
 */
export async function quickAddToLastNotebook(
  element: NotebookElement,
  options?: { timeRange?: RawTimeRange }
): Promise<boolean> {
  const lastUsed = getLastUsedNotebook();
  if (!lastUsed) {
    return false;
  }

  try {
    const result = await addElementToNotebook({ type: 'existing', uid: lastUsed.uid }, element, {
      timeRange: options?.timeRange,
      source: 'user',
    });
    appEvents.emit(AppEvents.alertSuccess, [t('notebooks.quick-add.added', 'Added to notebook'), result.title]);
    return true;
  } catch (error) {
    // Most likely the notebook was deleted; forget it and let the caller fall
    // back to the picker.
    clearLastUsedNotebook();
    return false;
  }
}
