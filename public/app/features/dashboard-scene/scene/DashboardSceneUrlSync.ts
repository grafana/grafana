import { config } from '@grafana/runtime';
import { SceneObjectUrlSyncHandler, SceneObjectUrlValues, VizPanel } from '@grafana/scenes';
import { contextSrv } from 'app/core/core';
import { KioskMode } from 'app/types/dashboard';

import { buildPanelEditScene } from '../panel-edit/PanelEditor';
import { createDashboardEditViewFor } from '../settings/utils';
import { ShareDrawer } from '../sharing/ShareDrawer/ShareDrawer';
import { ShareModal } from '../sharing/ShareModal';
import { findEditPanel, getLibraryPanelBehavior } from '../utils/utils';

import { DashboardScene, DashboardSceneState } from './DashboardScene';
import { LibraryPanelBehavior } from './LibraryPanelBehavior';
import { DefaultGridLayoutManager } from './layout-default/DefaultGridLayoutManager';

export class DashboardSceneUrlSync implements SceneObjectUrlSyncHandler {
  constructor(private _scene: DashboardScene) {}

  getKeys(): string[] {
    return ['inspect', 'viewPanel', 'editPanel', 'editview', 'autofitpanels', 'kiosk', 'shareView'];
  }

  getUrlState(): SceneObjectUrlValues {
    const state = this._scene.state;

    return {
      autofitpanels: this.getAutoFitPanels(),
      viewPanel: state.viewPanel,
      editview: state.editview?.getUrlKey(),
      editPanel: state.editPanel?.getUrlKey() || undefined,
      kiosk: state.kioskMode === KioskMode.Full ? 'true' : undefined,
      shareView: state.shareView,
      orgId: contextSrv.user.orgId.toString(),
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
        this._waitForLibPanelToLoadBeforeEnteringPanelEdit(panel, libPanelBehavior);
        return;
      }

      update.editPanel = buildPanelEditScene(panel);
    } else if (editPanel && values.editPanel === null) {
      update.editPanel = undefined;
    }

    if (typeof values.shareView === 'string') {
      update.shareView = values.shareView;
      update.overlay = config.featureToggles.newDashboardSharingComponent
        ? new ShareDrawer({
            shareView: values.shareView,
          })
        : new ShareModal({
            activeTab: values.shareView,
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

    if (typeof values.kiosk === 'string') {
      if (values.kiosk === 'true' || values.kiosk === '') {
        update.kioskMode = KioskMode.Full;
      }
    }

    if (Object.keys(update).length > 0) {
      this._scene.setState(update);
    }
  }

  /**
   * Temporary solution, with some refactoring of PanelEditor we can remove this
   */
  private _waitForLibPanelToLoadBeforeEnteringPanelEdit(panel: VizPanel, libPanel: LibraryPanelBehavior) {
    const sub = libPanel.subscribeToState((state) => {
      if (state.isLoaded) {
        this._scene.setState({ editPanel: buildPanelEditScene(panel) });
        sub.unsubscribe();
      }
    });
  }
}
