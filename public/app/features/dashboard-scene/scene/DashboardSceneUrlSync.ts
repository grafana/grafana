import { Unsubscribable } from 'rxjs';

import { AppEvents } from '@grafana/data';
import { config, locationService } from '@grafana/runtime';
import {
  SceneGridLayout,
  SceneObjectBase,
  SceneObjectState,
  SceneObjectUrlSyncHandler,
  SceneObjectUrlValues,
  VizPanel,
} from '@grafana/scenes';
import appEvents from 'app/core/app_events';
import { KioskMode } from 'app/types';

import { PanelInspectDrawer } from '../inspect/PanelInspectDrawer';
import { buildPanelEditScene } from '../panel-edit/PanelEditor';
import { createDashboardEditViewFor } from '../settings/utils';
import { ShareDrawer } from '../sharing/ShareDrawer/ShareDrawer';
import { ShareModal } from '../sharing/ShareModal';
import { findVizPanelByKey, getDashboardSceneFor, getLibraryPanel, isPanelClone } from '../utils/utils';

import { DashboardScene, DashboardSceneState } from './DashboardScene';
import { LibraryVizPanel } from './LibraryVizPanel';
import { ViewPanelScene } from './ViewPanelScene';
import { DashboardRepeatsProcessedEvent } from './types';

export class DashboardSceneUrlSync implements SceneObjectUrlSyncHandler {
  private _eventSub?: Unsubscribable;

  constructor(private _scene: DashboardScene) {}

  getKeys(): string[] {
    return ['inspect', 'viewPanel', 'editPanel', 'editview', 'autofitpanels', 'kiosk', 'shareView'];
  }

  getUrlState(): SceneObjectUrlValues {
    const state = this._scene.state;
    return {
      inspect: state.inspectPanelKey,
      autofitpanels: state.body instanceof SceneGridLayout && !!state.body.state.UNSAFE_fitPanels ? 'true' : undefined,
      viewPanel: state.viewPanelScene?.getUrlKey(),
      editview: state.editview?.getUrlKey(),
      editPanel: state.editPanel?.getUrlKey() || undefined,
      kiosk: state.kioskMode === KioskMode.Full ? '' : state.kioskMode === KioskMode.TV ? 'tv' : undefined,
      shareView: state.shareView,
    };
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
        appEvents.emit(AppEvents.alertError, ['Panel not found']);
        locationService.partial({ inspect: null });
        return;
      }

      if (getLibraryPanel(panel)) {
        this._handleLibraryPanel(panel, (p) => {
          if (p.state.key === undefined) {
            // Inspect drawer require a panel key to be set
            throw new Error('library panel key is undefined');
          }
          const drawer = new PanelInspectDrawer({
            $behaviors: [new ResolveInspectPanelByKey({ panelKey: p.state.key })],
          });
          this._scene.setState({ overlay: drawer, inspectPanelKey: p.state.key });
        });
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

      if (getLibraryPanel(panel)) {
        this._handleLibraryPanel(panel, (p) => this._buildLibraryPanelViewScene(p));
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
      if (getLibraryPanel(panel)) {
        this._handleLibraryPanel(panel, (p) => {
          this._scene.setState({ editPanel: buildPanelEditScene(p) });
        });
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

    if (this._scene.state.body instanceof SceneGridLayout) {
      const UNSAFE_fitPanels = typeof values.autofitpanels === 'string';

      if (!!this._scene.state.body.state.UNSAFE_fitPanels !== UNSAFE_fitPanels) {
        this._scene.state.body.setState({ UNSAFE_fitPanels });
      }
    }

    if (typeof values.kiosk === 'string') {
      if (values.kiosk === 'true' || values.kiosk === '') {
        update.kioskMode = KioskMode.Full;
      } else if (values.kiosk === 'tv') {
        update.kioskMode = KioskMode.TV;
      }
    }

    if (Object.keys(update).length > 0) {
      this._scene.setState(update);
    }
  }

  private _buildLibraryPanelViewScene(vizPanel: VizPanel) {
    this._scene.setState({ viewPanelScene: new ViewPanelScene({ panelRef: vizPanel.getRef() }) });
  }

  private _handleLibraryPanel(vizPanel: VizPanel, cb: (p: VizPanel) => void): void {
    if (!(vizPanel.parent instanceof LibraryVizPanel)) {
      throw new Error('Panel is not a child of a LibraryVizPanel');
    }
    const libraryPanel = vizPanel.parent;
    if (libraryPanel.state.isLoaded) {
      cb(vizPanel);
    } else {
      libraryPanel.subscribeToState((n) => {
        cb(n.panel!);
      });
      libraryPanel.activate();
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
