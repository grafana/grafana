import { type SceneObjectUrlSyncHandler, type SceneObjectUrlValues } from '@grafana/scenes';

import { buildPanelEditScene } from '../panel-edit/PanelEditor';
import { createDashboardEditViewFor } from '../settings/createDashboardEditViewFor';
import { ShareDrawer } from '../sharing/ShareDrawer/ShareDrawer';
import { findEditPanel, getLibraryPanelBehavior } from '../utils/utils';

import { type DashboardScene } from './DashboardScene';
import { type LibraryPanelBehavior } from './LibraryPanelBehavior';
import { UNCONFIGURED_PANEL_PLUGIN_ID } from './UnconfiguredPanel';
import { DefaultGridLayoutManager } from './layout-default/DefaultGridLayoutManager';
import { type DashboardSceneState } from './types/dashboard';

export class DashboardSceneUrlSync implements SceneObjectUrlSyncHandler {
  constructor(private _scene: DashboardScene) {}

  getKeys(): string[] {
    return ['inspect', 'viewPanel', 'editPanel', 'editview', 'autofitpanels', 'shareView'];
  }

  getUrlState(): SceneObjectUrlValues {
    const state = this._scene.state;

    return {
      autofitpanels: this.getAutoFitPanels(),
      viewPanel: state.viewPanel,
      editview: state.editview?.getUrlKey(),
      editPanel: state.editPanel?.getUrlKey() || undefined,
      shareView: state.shareView,
    };
  }

  private getAutoFitPanels(): string | undefined {
    if (this._scene.state.body instanceof DefaultGridLayoutManager) {
      return this._scene.state.body.state.grid.state.UNSAFE_fitPanels ? 'true' : undefined;
    }

    return undefined;
  }

  updateFromUrl(values: SceneObjectUrlValues): void {
    const { viewPanel, isEditing, editPanel, shareView } = this._scene.state;
    const update: Partial<DashboardSceneState> = {};

    if (typeof values.editview === 'string' && this._scene.canEditDashboard()) {
      update.editview = createDashboardEditViewFor(values.editview);

      // If we are not in editing (for example after full page reload)
      if (!isEditing) {
        if (this._scene.state.editable) {
          // Not sure what is best to do here.
          // The reason for the timeout is for this change to happen after the url sync has completed
          setTimeout(() => this._scene.onEnterEditMode());
        } else {
          update.editview = undefined;
        }
      }
    } else if (values.hasOwnProperty('editview')) {
      update.editview = undefined;
    }

    // Handle view panel state
    if (typeof values.viewPanel === 'string') {
      update.viewPanel = values.viewPanel;
    } else if (viewPanel && values.viewPanel === null) {
      update.viewPanel = undefined;
    }

    // Handle edit panel state
    if (typeof values.editPanel === 'string') {
      const panel = findEditPanel(this._scene, values.editPanel);

      if (!panel) {
        console.warn(`Panel ${values.editPanel} not found`);
        return;
      }

      // We cannot simultaneously be in edit and view panel state.
      if (this._scene.state.viewPanel) {
        update.viewPanel = undefined;
      }

      // If we are not in editing (for example after full page reload)
      if (!isEditing) {
        this._scene.onEnterEditMode();
      }

      const libPanelBehavior = getLibraryPanelBehavior(panel);
      if (libPanelBehavior && !libPanelBehavior?.state.isLoaded) {
        this._waitForLibPanelToLoadBeforeEnteringPanelEdit(values.editPanel, libPanelBehavior);
        return;
      }

      update.editPanel = buildPanelEditScene(panel, panel.state.pluginId === UNCONFIGURED_PANEL_PLUGIN_ID);
    } else if (editPanel && values.editPanel === null) {
      update.editPanel = undefined;
    }

    if (typeof values.shareView === 'string') {
      update.shareView = values.shareView;
      update.overlay = new ShareDrawer({
        shareView: values.shareView,
      });
    } else if (shareView && values.shareView === null) {
      update.overlay = undefined;
      update.shareView = undefined;
    }

    const layout = this._scene.state.body;
    if (layout instanceof DefaultGridLayoutManager) {
      const UNSAFE_fitPanels = typeof values.autofitpanels === 'string';

      if (!!layout.state.grid.state.UNSAFE_fitPanels !== UNSAFE_fitPanels) {
        layout.state.grid.setState({ UNSAFE_fitPanels });
      }
    }

    if (Object.keys(update).length > 0) {
      this._scene.setState(update);
    }
  }

  /**
   * Temporary solution, with some refactoring of PanelEditor we can remove this
   */
  private _waitForLibPanelToLoadBeforeEnteringPanelEdit(panelId: string, libPanel: LibraryPanelBehavior) {
    const sub = libPanel.subscribeToState((state) => {
      if (state.isLoaded) {
        sub.unsubscribe();
        this._openPanelEditById(panelId);
      }
    });
  }

  /**
   * Open panel edit for an id resolved against the CURRENT tree.
   *
   * The wait above outlives the panel it was started for. A scene rebuild (APPLY_SPEC, the json and
   * code editors) replaces the whole layout tree, and `state.editPanel` is unset for the duration of
   * the wait, so nothing else can re-open the pane afterwards. Resolving the id again is what lets
   * the wait survive that: opening the editor on the panel it captured would instead leave the pane
   * driving a panel the dashboard no longer contains. If the panel it lands on is itself an unloaded
   * library panel, it waits once more, on the behavior the live tree holds.
   */
  private _openPanelEditById(panelId: string) {
    // The pane is closed for the whole wait, so anything the user does meanwhile is the newer
    // intent: leaving edit mode, or opening a different panel, would be silently undone by
    // re-opening on the id this wait captured.
    if (!this._scene.state.isEditing || this._scene.state.editPanel) {
      return;
    }

    const panel = findEditPanel(this._scene, panelId);
    if (!panel) {
      return;
    }

    const libPanelBehavior = getLibraryPanelBehavior(panel);
    if (libPanelBehavior && !libPanelBehavior.state.isLoaded) {
      this._waitForLibPanelToLoadBeforeEnteringPanelEdit(panelId, libPanelBehavior);
      return;
    }

    this._scene.setState({
      editPanel: buildPanelEditScene(panel, panel.state.pluginId === UNCONFIGURED_PANEL_PLUGIN_ID),
    });
  }
}
