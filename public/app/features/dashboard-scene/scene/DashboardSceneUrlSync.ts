import { Unsubscribable } from 'rxjs';

import { AppEvents } from '@grafana/data';
import { locationService } from '@grafana/runtime';
import { SceneObjectBase, SceneObjectState, SceneObjectUrlSyncHandler, SceneObjectUrlValues } from '@grafana/scenes';
import appEvents from 'app/core/app_events';

import { PanelInspectDrawer } from '../inspect/PanelInspectDrawer';
import { buildPanelEditScene } from '../panel-edit/PanelEditor';
import { createDashboardEditViewFor } from '../settings/utils';
import { findVizPanelByKey, getDashboardSceneFor, isPanelClone } from '../utils/utils';

import { DashboardScene, DashboardSceneState } from './DashboardScene';
import { ViewPanelScene } from './ViewPanelScene';
import { DashboardRepeatsProcessedEvent } from './types';

export class DashboardSceneUrlSync implements SceneObjectUrlSyncHandler {
  private _eventSub?: Unsubscribable;

  constructor(private _scene: DashboardScene) {}

  getKeys(): string[] {
    return ['inspect', 'viewPanel', 'editPanel', 'editview'];
  }

  getUrlState(): SceneObjectUrlValues {
    const state = this._scene.state;
    return {
      inspect: state.inspectPanelKey,
      viewPanel: state.viewPanelScene?.getUrlKey(),
      editview: state.editview?.getUrlKey(),
      editPanel: state.editPanel?.getUrlKey() || undefined,
    };
  }

  updateFromUrl(values: SceneObjectUrlValues): void {
    const { inspectPanelKey, viewPanelScene, isEditing, editPanel } = this._scene.state;
    const update: Partial<DashboardSceneState> = {};

    if (typeof values.editview === 'string' && this._scene.canEditDashboard()) {
      update.editview = createDashboardEditViewFor(values.editview);

      // If we are not in editing (for example after full page reload)
      if (!isEditing) {
        // Not sure what is best to do here.
        // The reason for the timeout is for this change to happen after the url sync has completed
        setTimeout(() => this._scene.onEnterEditMode());
      }
    } else if (values.hasOwnProperty('editview')) {
      update.editview = undefined;
    }

    // Handle inspect object state
    if (typeof values.inspect === 'string') {
      let panel = findVizPanelByKey(this._scene, values.inspect);
      if (!panel) {
        appEvents.emit(AppEvents.alertError, ['Panel not found']);
        locationService.partial({ inspect: null });
        return;
      }

      update.inspectPanelKey = values.inspect;
      update.overlay = new PanelInspectDrawer({
        $behaviors: [new ResolveInspectPanelByKey({ panelKey: values.inspect })],
      });
    } else if (inspectPanelKey) {
      update.inspectPanelKey = undefined;
      update.overlay = undefined;
    }

    // Handle view panel state
    if (typeof values.viewPanel === 'string') {
      const panel = findVizPanelByKey(this._scene, values.viewPanel);
      if (!panel) {
        // // If we are trying to view a repeat clone that can't be found it might be that the repeats have not been processed yet
        if (isPanelClone(values.viewPanel)) {
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
      const panel = findVizPanelByKey(this._scene, values.editPanel);
      if (!panel) {
        return;
      }

      // If we are not in editing (for example after full page reload)
      if (!isEditing) {
        this._scene.onEnterEditMode();
      }
      update.editPanel = buildPanelEditScene(panel);
    } else if (editPanel && values.editPanel === null) {
      update.editPanel = undefined;
    }

    if (Object.keys(update).length > 0) {
      this._scene.setState(update);
    }
  }

  private _handleViewRepeatClone(viewPanel: string) {
    if (!this._eventSub) {
      this._eventSub = this._scene.subscribeToEvent(DashboardRepeatsProcessedEvent, () => {
        const panel = findVizPanelByKey(this._scene, viewPanel);
        if (panel) {
          this._eventSub?.unsubscribe();
          this._scene.setState({ viewPanelScene: new ViewPanelScene({ panelRef: panel.getRef() }) });
        }
      });
    }
  }
}

interface ResolveInspectPanelByKeyState extends SceneObjectState {
  panelKey: string;
}

class ResolveInspectPanelByKey extends SceneObjectBase<ResolveInspectPanelByKeyState> {
  constructor(state: ResolveInspectPanelByKeyState) {
    super(state);
    this.addActivationHandler(this._onActivate);
  }

  private _onActivate = () => {
    const parent = this.parent;

    if (!parent || !(parent instanceof PanelInspectDrawer)) {
      throw new Error('ResolveInspectPanelByKey must be attached to a PanelInspectDrawer');
    }

    const dashboard = getDashboardSceneFor(parent);
    if (!dashboard) {
      return;
    }
    const panelId = this.state.panelKey;
    let panel = findVizPanelByKey(dashboard, panelId);

    if (dashboard.state.editPanel) {
      panel = dashboard.state.editPanel.state.vizManager.state.panel;
    }

    if (dashboard.state.viewPanelScene && dashboard.state.viewPanelScene.state.body) {
      panel = dashboard.state.viewPanelScene.state.body;
    }

    if (panel) {
      parent.setState({ panelRef: panel.getRef() });
    }
  };
}
