import { Unsubscribable } from 'rxjs';

import { AppEvents } from '@grafana/data';
import { config, locationService } from '@grafana/runtime';
import { SceneObjectUrlSyncHandler, SceneObjectUrlValues, VizPanel } from '@grafana/scenes';
import appEvents from 'app/core/app_events';
import { contextSrv } from 'app/core/core';
import { KioskMode } from 'app/types/dashboard';

import { PanelInspectDrawer } from '../inspect/PanelInspectDrawer';
import { buildPanelEditScene } from '../panel-edit/PanelEditor';
import { createDashboardEditViewFor } from '../settings/utils';
import { ShareDrawer } from '../sharing/ShareDrawer/ShareDrawer';
import { ShareModal } from '../sharing/ShareModal';
import { containsPathIdSeparator, findVizPanelByPathId } from '../utils/pathId';
import { findEditPanel, findVizPanelByKey, getLibraryPanelBehavior } from '../utils/utils';

import { DashboardScene, DashboardSceneState } from './DashboardScene';
import { LibraryPanelBehavior } from './LibraryPanelBehavior';
import { ViewPanelScene } from './ViewPanelScene';
import { DefaultGridLayoutManager } from './layout-default/DefaultGridLayoutManager';
import { DashboardRepeatsProcessedEvent } from './types/DashboardRepeatsProcessedEvent';

export class DashboardSceneUrlSync implements SceneObjectUrlSyncHandler {
  private _viewEventSub?: Unsubscribable;
  private _inspectEventSub?: Unsubscribable;

  constructor(private _scene: DashboardScene) {}

  getKeys(): string[] {
    return ['inspect', 'viewPanel', 'editPanel', 'editview', 'autofitpanels', 'kiosk', 'shareView'];
  }

  getUrlState(): SceneObjectUrlValues {
    const state = this._scene.state;

    return {
      inspect: state.inspectPanelKey,
      autofitpanels: this.getAutoFitPanels(),
      viewPanel: state.viewPanelScene?.getUrlKey(),
      editview: state.editview?.getUrlKey(),
      editPanel: state.editPanel?.getUrlKey() || undefined,
      kiosk: state.kioskMode === KioskMode.Full ? '' : undefined,
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
    const { inspectPanelKey, viewPanelScene, isEditing, editPanel, shareView } = this._scene.state;
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

    // Handle inspect object state
    if (typeof values.inspect === 'string') {
      let panel = findVizPanelByKey(this._scene, values.inspect);
      if (!panel) {
        // If we are trying to view a repeat clone that can't be found it might be that the repeats have not been processed yet
        // Here we check if the key contains the clone key so we force the repeat processing
        // It doesn't matter if the element or the ancestors are clones or not, just that the key contains the clone key
        if (containsPathIdSeparator(values.inspect)) {
          this._handleInspectRepeatClone(values.inspect);
          return;
        }

        appEvents.emit(AppEvents.alertError, ['Panel not found']);
        locationService.partial({ inspect: null });
        return;
      }

      update.inspectPanelKey = values.inspect;
      update.overlay = new PanelInspectDrawer({ panelRef: panel.getRef() });
    } else if (inspectPanelKey) {
      update.inspectPanelKey = undefined;
      update.overlay = undefined;
    }

    // Handle view panel state
    if (typeof values.viewPanel === 'string') {
      const panel = findVizPanelByPathId(this._scene, values.viewPanel);

      if (!panel) {
        // If we are trying to view a repeat clone that can't be found it might be that the repeats have not been processed yet
        // Here we check if the key contains the clone key so we force the repeat processing
        // It doesn't matter if the element or the ancestors are clones or not, just that the key contains the clone key
        if (containsPathIdSeparator(values.viewPanel)) {
          this._handleViewRepeatClone(values.viewPanel);
          return;
        }

        appEvents.emit(AppEvents.alertError, ['Panel not found']);
        locationService.partial({ viewPanel: null });
        return;
      }

      update.viewPanelScene = new ViewPanelScene({ panelRef: panel.getRef() });
    } else if (viewPanelScene && values.viewPanel === null) {
      update.viewPanelScene = undefined;
    }

    // Handle edit panel state
    if (typeof values.editPanel === 'string') {
      const panel = findEditPanel(this._scene, values.editPanel);

      if (!panel) {
        console.warn(`Panel ${values.editPanel} not found`);
        return;
      }

      // We cannot simultaneously be in edit and view panel state.
      if (this._scene.state.viewPanelScene) {
        this._scene.setState({ viewPanelScene: undefined });
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

  private _handleInspectRepeatClone(inspect: string) {
    if (!this._inspectEventSub) {
      this._inspectEventSub = this._scene.subscribeToEvent(DashboardRepeatsProcessedEvent, () => {
        const panel = findVizPanelByKey(this._scene, inspect);
        if (panel) {
          this._inspectEventSub?.unsubscribe();
          this._scene.setState({
            inspectPanelKey: inspect,
            overlay: new PanelInspectDrawer({ panelRef: panel.getRef() }),
          });
        }
      });
    }
  }

  private _handleViewRepeatClone(viewPanel: string) {
    if (!this._viewEventSub) {
      this._viewEventSub = this._scene.subscribeToEvent(DashboardRepeatsProcessedEvent, () => {
        const panel = findVizPanelByPathId(this._scene, viewPanel);
        if (panel) {
          this._viewEventSub?.unsubscribe();
          this._scene.setState({ viewPanelScene: new ViewPanelScene({ panelRef: panel.getRef() }) });
          this._viewEventSub = undefined;
        }
      });

      this._scene.state.body.activateRepeaters?.();
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
