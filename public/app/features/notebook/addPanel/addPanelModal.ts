import { t } from '@grafana/i18n';

/**
 * Deliberately free of any heavy imports. Both entry points load with the app and need these two
 * values before the picker itself is loaded, so anything imported here lands in the main bundle.
 */

/** Shared so the dashboard's own Modal and Explore's plugin-extension modal carry the same title. */
export function addPanelToNotebookTitle(): string {
  return t('notebooks.add-panel.title', 'Add panel to notebook');
}

/**
 * Wider than the 750px default so a notebook title, its meta line and its tags fit on one row
 * without the card wrapping. Shared with Explore, whose modal chrome takes a width rather than a
 * class.
 */
export const ADD_PANEL_MODAL_WIDTH = 900;
