import * as H from 'history';

import { NavIndex } from '@grafana/data';
import { config, locationService } from '@grafana/runtime';
import { SceneGridItem, SceneGridLayout, SceneObjectBase, SceneObjectState, VizPanel } from '@grafana/scenes';

import { LibraryVizPanel } from '../scene/LibraryVizPanel';
import { PanelRepeaterGridItem } from '../scene/PanelRepeaterGridItem';
import { getDashboardSceneFor, getPanelIdForVizPanel } from '../utils/utils';

import { PanelDataPane } from './PanelDataPane/PanelDataPane';
import { PanelEditorRenderer } from './PanelEditorRenderer';
import { PanelOptionsPane } from './PanelOptionsPane';
import { VizPanelManager, VizPanelManagerState } from './VizPanelManager';

export interface PanelEditorState extends SceneObjectState {
  isDirty?: boolean;
  panelId: number;
  optionsPane: PanelOptionsPane;
  dataPane?: PanelDataPane;
  vizManager: VizPanelManager;
  showLibraryPanelSaveModal?: boolean;
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
        if (n.panel.state.pluginId !== p.panel.state.pluginId) {
          this._initDataPane(n.panel.state.pluginId);
        }
      })
    );

    this._initDataPane(panel.state.pluginId);

    return () => {
      if (!this._discardChanges) {
        this.commitChanges();
      }
    };
  }

  private _initDataPane(pluginId: string) {
    const skipDataQuery = config.panels[pluginId].skipDataQuery;

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

    const normalToRepeat = !this._initialRepeatOptions.repeat && panelManager.state.repeat;
    const repeatToNormal = this._initialRepeatOptions.repeat && !panelManager.state.repeat;

    if (sourcePanelParent instanceof LibraryVizPanel) {
      // Library panels handled separately
      return;
    } else if (sourcePanelParent instanceof SceneGridItem) {
      if (normalToRepeat) {
        this.replaceSceneGridItemWithPanelRepeater(sourcePanelParent);
      } else {
        panelManager.commitChanges();
      }
    } else if (sourcePanelParent instanceof PanelRepeaterGridItem) {
      if (repeatToNormal) {
        this.replacePanelRepeaterWithGridItem(sourcePanelParent);
      } else {
        this.handleRepeatOptionChanges(sourcePanelParent);
      }
    } else {
      console.error('Unsupported scene object type');
    }
  }

  private replaceSceneGridItemWithPanelRepeater(gridItem: SceneGridItem) {
    const gridLayout = gridItem.parent;
    if (!(gridLayout instanceof SceneGridLayout)) {
      console.error('Expected grandparent to be SceneGridLayout!');
      return;
    }

    const panelManager = this.state.vizManager;
    const repeatDirection = panelManager.state.repeatDirection ?? 'h';
    const repeater = new PanelRepeaterGridItem({
      key: gridItem.state.key,
      x: gridItem.state.x,
      y: gridItem.state.y,
      width: repeatDirection === 'h' ? 24 : gridItem.state.width,
      height: gridItem.state.height,
      itemHeight: gridItem.state.height,
      source: panelManager.getPanelCloneWithData(),
      variableName: panelManager.state.repeat!,
      repeatedPanels: [],
      repeatDirection: panelManager.state.repeatDirection,
      maxPerRow: panelManager.state.maxPerRow,
    });
    gridLayout.setState({
      children: gridLayout.state.children.map((child) => (child.state.key === gridItem.state.key ? repeater : child)),
    });
  }

  private replacePanelRepeaterWithGridItem(panelRepeater: PanelRepeaterGridItem) {
    const gridLayout = panelRepeater.parent;
    if (!(gridLayout instanceof SceneGridLayout)) {
      console.error('Expected grandparent to be SceneGridLayout!');
      return;
    }

    const panelManager = this.state.vizManager;
    const panelClone = panelManager.getPanelCloneWithData();
    const gridItem = new SceneGridItem({
      key: panelRepeater.state.key,
      x: panelRepeater.state.x,
      y: panelRepeater.state.y,
      width: this._initialRepeatOptions.repeatDirection === 'h' ? 8 : panelRepeater.state.width,
      height: this._initialRepeatOptions.repeatDirection === 'v' ? 8 : panelRepeater.state.height,
      body: panelClone,
    });
    gridLayout.setState({
      children: gridLayout.state.children.map((child) =>
        child.state.key === panelRepeater.state.key ? gridItem : child
      ),
    });
  }

  private handleRepeatOptionChanges(panelRepeater: PanelRepeaterGridItem) {
    let width = panelRepeater.state.width ?? 1;
    let height = panelRepeater.state.height;

    const panelManager = this.state.vizManager;
    const horizontalToVertical =
      this._initialRepeatOptions.repeatDirection === 'h' && panelManager.state.repeatDirection === 'v';
    const verticalToHorizontal =
      this._initialRepeatOptions.repeatDirection === 'v' && panelManager.state.repeatDirection === 'h';
    if (horizontalToVertical) {
      width = Math.floor(width / (panelRepeater.state.maxPerRow ?? 1));
    } else if (verticalToHorizontal) {
      width = 24;
    }

    panelRepeater.setState({
      source: panelManager.getPanelCloneWithData(),
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

  public onDismissLibraryPanelModal = () => {
    this.setState({ showLibraryPanelSaveModal: false });
  };
}

export function buildPanelEditScene(panel: VizPanel): PanelEditor {
  return new PanelEditor({
    panelId: getPanelIdForVizPanel(panel),
    optionsPane: new PanelOptionsPane({}),
    vizManager: VizPanelManager.createFor(panel),
  });
}
