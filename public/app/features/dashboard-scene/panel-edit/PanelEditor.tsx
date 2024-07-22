import * as H from 'history';

import { NavIndex } from '@grafana/data';
import { config, locationService } from '@grafana/runtime';
import { SceneObjectBase, SceneObjectState, VizPanel } from '@grafana/scenes';

import { DashboardGridItem } from '../scene/DashboardGridItem';
import { LibraryVizPanel } from '../scene/LibraryVizPanel';
import { getDashboardSceneFor, getPanelIdForVizPanel } from '../utils/utils';

import { PanelDataPane } from './PanelDataPane/PanelDataPane';
import { PanelEditorRenderer } from './PanelEditorRenderer';
import { PanelOptionsPane } from './PanelOptionsPane';
import { VizPanelManager, VizPanelManagerState } from './VizPanelManager';

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
  private _initialRepeatOptions: Pick<VizPanelManagerState, 'repeat' | 'repeatDirection' | 'maxPerRow'> = {};
  static Component = PanelEditorRenderer;

  private _discardChanges = false;

  public constructor(state: PanelEditorState) {
    super(state);

    const { repeat, repeatDirection, maxPerRow } = state.vizManager.state;
    this._initialRepeatOptions = {
      repeat,
      repeatDirection,
      maxPerRow,
    };

    this.addActivationHandler(this._activationHandler.bind(this));
  }

  private _activationHandler() {
    const panelManager = this.state.vizManager;
    const panel = panelManager.state.panel;

    this._subs.add(
      panelManager.subscribeToState((n, p) => {
        if (n.pluginId !== p.pluginId) {
          this._initDataPane(n.pluginId);
        }
      })
    );

    this._initDataPane(panel.state.pluginId);

    return () => {
      if (!this._discardChanges) {
        this.commitChanges();
      } else if (this.state.isNewPanel) {
        getDashboardSceneFor(this).removePanel(panelManager.state.sourcePanel.resolve()!);
      }
    };
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
    this._discardChanges = true;
    locationService.partial({ editPanel: null });
  };

  public commitChanges() {
    const dashboard = getDashboardSceneFor(this);

    if (!dashboard.state.isEditing) {
      dashboard.onEnterEditMode();
    }

    const panelManager = this.state.vizManager;
    const sourcePanel = panelManager.state.sourcePanel.resolve();
    const sourcePanelParent = sourcePanel!.parent;
    const isLibraryPanel = sourcePanelParent instanceof LibraryVizPanel;

    const gridItem = isLibraryPanel ? sourcePanelParent.parent : sourcePanelParent;

    if (isLibraryPanel) {
      // Library panels handled separately
      return;
    }

    if (!(gridItem instanceof DashboardGridItem)) {
      console.error('Unsupported scene object type');
      return;
    }

    this.commitChangesToSource(gridItem);
  }

  private commitChangesToSource(gridItem: DashboardGridItem) {
    let width = gridItem.state.width ?? 1;
    let height = gridItem.state.height;

    const panelManager = this.state.vizManager;
    const horizontalToVertical =
      this._initialRepeatOptions.repeatDirection === 'h' && panelManager.state.repeatDirection === 'v';
    const verticalToHorizontal =
      this._initialRepeatOptions.repeatDirection === 'v' && panelManager.state.repeatDirection === 'h';
    if (horizontalToVertical) {
      width = Math.floor(width / (gridItem.state.maxPerRow ?? 1));
    } else if (verticalToHorizontal) {
      width = 24;
    }

    gridItem.setState({
      body: panelManager.state.panel.clone(),
      repeatDirection: panelManager.state.repeatDirection,
      variableName: panelManager.state.repeat,
      maxPerRow: panelManager.state.maxPerRow,
      width,
      height,
    });
  }

  public onSaveLibraryPanel = () => {
    this.setState({ showLibraryPanelSaveModal: true });
  };

  public onConfirmSaveLibraryPanel = () => {
    this.state.vizManager.commitChanges();
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
