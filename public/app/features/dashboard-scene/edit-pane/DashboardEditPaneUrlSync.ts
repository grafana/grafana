import { type SceneObjectUrlSyncHandler, type SceneObjectUrlValues } from '@grafana/scenes';

import { getDashboardSceneFor } from '../utils/utils';

import { DashboardCodePane } from './DashboardCodePane';
import { type DashboardEditPane } from './DashboardEditPane';

export const SIDEBAR_PANE_URL_KEY = 'sidebar';

/**
 * Syncs the currently open sidebar pane with the URL so it can be linked to and restored on reload.
 * Only panes that expose a stable `getUrlKey()` (e.g. the "Edit as code" pane) participate.
 */
export class DashboardEditPaneUrlSync implements SceneObjectUrlSyncHandler {
  constructor(private _editPane: DashboardEditPane) {}

  public getKeys(): string[] {
    return [SIDEBAR_PANE_URL_KEY];
  }

  public getUrlState(): SceneObjectUrlValues {
    return {
      [SIDEBAR_PANE_URL_KEY]: this._editPane.state.openPane?.getUrlKey?.(),
    };
  }

  public updateFromUrl(values: SceneObjectUrlValues): void {
    if (!values.hasOwnProperty(SIDEBAR_PANE_URL_KEY)) {
      return;
    }

    const currentKey = this._editPane.state.openPane?.getUrlKey?.();
    const nextKey = values[SIDEBAR_PANE_URL_KEY];

    if (nextKey === currentKey) {
      return;
    }

    // Only the "Edit as code" pane can be reconstructed from the URL for now.
    if (nextKey === 'code') {
      this.openCodePane();
    } else if (currentKey === 'code') {
      // The URL no longer references the code pane, so close it.
      this._editPane.closePane();
    }
  }

  private openCodePane() {
    const dashboard = getDashboardSceneFor(this._editPane);

    if (dashboard.state.isEditing) {
      this._editPane.openPane(new DashboardCodePane({}));
      return;
    }

    if (!dashboard.state.editable || !dashboard.canEditDashboard()) {
      return;
    }

    // On a full page reload we may not be in edit mode yet. Enter it after the current url sync
    // pass completes, then open the pane (mirrors how the dashboard handles ?editview and ?editPanel).
    setTimeout(() => {
      dashboard.onEnterEditMode();
      this._editPane.openPane(new DashboardCodePane({}));
    });
  }
}
