import * as H from 'history';

import { NavIndex } from '@grafana/data';
import { config, locationService } from '@grafana/runtime';
import { SceneObjectBase, SceneObjectState, VizPanel, VizPanelState } from '@grafana/scenes';

import { getDashboardSceneFor, getPanelIdForVizPanel } from '../utils/utils';

import { PanelDataPane } from './PanelDataPane/PanelDataPane';
import { PanelEditorRenderer } from './PanelEditorRenderer';
import { PanelOptionsPane } from './PanelOptionsPane';
import { VizPanelManager } from './VizPanelManager';

export interface PanelEditorState extends SceneObjectState {
  isNewPanel: boolean;
  isDirty?: boolean;
  panelId: number;
  optionsPane: PanelOptionsPane;
  dataPane?: PanelDataPane;
  vizManager: VizPanelManager;
  showLibraryPanelSaveModal?: boolean;
  showLibraryPanelUnlinkModal?: boolean;
}

export class PanelEditor extends SceneObjectBase<PanelEditorState> {
  static Component = PanelEditorRenderer;

  public constructor(state: PanelEditorState) {
    super(state);
    this.addActivationHandler(this._activationHandler.bind(this));
  }

  private _activationHandler() {
    const panelManager = this.state.vizManager;

    this._subs.add(
      panelManager.subscribeToState((n, p) => {
        if (n.pluginId !== p.pluginId) {
          this._initDataPane(n.pluginId);
        }
      })
    );

    this._initDataPane(panelManager.getPanel().state.pluginId);
  }

  private _initDataPane(pluginId: string) {
    const skipDataQuery = config.panels[pluginId]?.skipDataQuery;

    if (skipDataQuery && this.state.dataPane) {
      locationService.partial({ tab: null }, true);
      this.setState({ dataPane: undefined });
    }

    if (!skipDataQuery && !this.state.dataPane) {
      this.setState({ dataPane: new PanelDataPane(this.state.vizManager) });
    }
  }

  public getUrlKey() {
    return this.state.panelId.toString();
  }

  public getPageNav(location: H.Location, navIndex: NavIndex) {
    const dashboard = getDashboardSceneFor(this);

    return {
      text: 'Edit panel',
      parentItem: dashboard.getPageNav(location, navIndex),
    };
  }

  public onDiscard = () => {
    this.state.vizManager.discardChanges();

    if (this.state.isNewPanel) {
      getDashboardSceneFor(this).removePanel(this.state.vizManager.getPanel());
    }

    locationService.partial({ editPanel: null });
  };

  public onSaveLibraryPanel = () => {
    this.setState({ showLibraryPanelSaveModal: true });
  };

  public onConfirmSaveLibraryPanel = () => {
    this.state.vizManager.saveLibPanel();
    this.state.vizManager.setState({ isDirty: false });
    locationService.partial({ editPanel: null });
  };

  public onDismissLibraryPanelSaveModal = () => {
    this.setState({ showLibraryPanelSaveModal: false });
  };

  public onUnlinkLibraryPanel = () => {
    this.setState({ showLibraryPanelUnlinkModal: true });
  };

  public onDismissUnlinkLibraryPanelModal = () => {
    this.setState({ showLibraryPanelUnlinkModal: false });
  };

  public onConfirmUnlinkLibraryPanel = () => {
    this.state.vizManager.unlinkLibraryPanel();
    this.setState({ showLibraryPanelUnlinkModal: false });
  };
}

export function buildPanelEditScene(panel: VizPanel, isNewPanel = false): PanelEditor {
  return new PanelEditor({
    panelId: getPanelIdForVizPanel(panel),
    optionsPane: new PanelOptionsPane({}),
    vizManager: VizPanelManager.createFor(panel),
    isNewPanel,
  });
}
