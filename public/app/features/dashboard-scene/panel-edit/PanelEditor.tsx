import * as H from 'history';

import { NavIndex } from '@grafana/data';
import { config, locationService } from '@grafana/runtime';
import { SceneGridItem, SceneObject, SceneObjectBase, SceneObjectState, VizPanel } from '@grafana/scenes';

import {
  findVizPanelByKey,
  getDashboardSceneFor,
  getPanelIdForVizPanel,
  getVizPanelKeyForPanelId,
} from '../utils/utils';

import { PanelDataPane } from './PanelDataPane/PanelDataPane';
import { PanelEditorRenderer } from './PanelEditorRenderer';
import { PanelOptionsPane } from './PanelOptionsPane';
import { VizPanelManager } from './VizPanelManager';

export interface PanelEditorState extends SceneObjectState {
  controls?: SceneObject[];
  isDirty?: boolean;
  panelId: number;
  optionsPane: PanelOptionsPane;
  optionsCollapsed?: boolean;
  optionsPaneSize: number;
  dataPane?: PanelDataPane;
  vizManager: VizPanelManager;
}

export class PanelEditor extends SceneObjectBase<PanelEditorState> {
  static Component = PanelEditorRenderer;

  private _discardChanges = false;

  public constructor(state: PanelEditorState) {
    super(state);

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
    const sourcePanel = findVizPanelByKey(dashboard.state.body, getVizPanelKeyForPanelId(this.state.panelId));

    if (!dashboard.state.isEditing) {
      dashboard.onEnterEditMode();
    }

    if (sourcePanel!.parent instanceof SceneGridItem) {
      sourcePanel!.parent.setState({ body: this.state.vizManager.state.panel.clone() });
    }
  }

  public toggleOptionsPane() {
    this.setState({ optionsCollapsed: this.state.optionsCollapsed });
  }

  public onOptionsPaneResizing = (size: number) => {
    const optionsPaneSize = 1 - size;

    if (this.state.optionsCollapsed && optionsPaneSize > MIN_PANEL_OPTIONS_PANE_SIZE) {
      this.setState({ optionsCollapsed: false });
    }

    if (!this.state.optionsCollapsed && optionsPaneSize < MIN_PANEL_OPTIONS_PANE_SIZE) {
      this.setState({ optionsCollapsed: true });
    }
  };

  public onOptionsPaneSizeChanged = (size: number) => {
    const newPaneSize = 1 - size;
    const isSnappedClosed = this.state.optionsPaneSize === 0;

    if (this.state.optionsCollapsed) {
      if (isSnappedClosed) {
        this.setState({
          optionsPaneSize: Math.max(newPaneSize, DEFAULT_PANEL_OPTIONS_PANE_SIZE),
          optionsCollapsed: false,
        });
      } else {
        this.setState({ optionsPaneSize: 0 });
      }
    }
  };
}

export const MIN_PANEL_OPTIONS_PANE_SIZE = 0.17;
export const DEFAULT_PANEL_OPTIONS_PANE_SIZE = 0.25;

export function buildPanelEditScene(panel: VizPanel): PanelEditor {
  const panelClone = panel.clone();
  const vizPanelMgr = new VizPanelManager(panelClone);

  return new PanelEditor({
    panelId: getPanelIdForVizPanel(panel),
    optionsPane: new PanelOptionsPane({}),
    vizManager: vizPanelMgr,
    optionsPaneSize: 0.25,
  });
}
