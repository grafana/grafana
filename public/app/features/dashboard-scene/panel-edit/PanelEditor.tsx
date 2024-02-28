import * as H from 'history';

import { NavIndex } from '@grafana/data';
import { config, locationService } from '@grafana/runtime';
import { SceneObjectBase, SceneObjectState, VizPanel } from '@grafana/scenes';

import { getDashboardSceneFor, getPanelIdForVizPanel } from '../utils/utils';

import { PanelDataPane } from './PanelDataPane/PanelDataPane';
import { PanelEditorRenderer } from './PanelEditorRenderer';
import { PanelOptionsPane } from './PanelOptionsPane';
import { VizPanelManager } from './VizPanelManager';

export interface PanelEditorState extends SceneObjectState {
  isDirty?: boolean;
  panelId: number;
  optionsPane: PanelOptionsPane;
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

    if (!dashboard.state.isEditing) {
      dashboard.onEnterEditMode();
    }

    this.state.vizManager.commitChanges();
  }

  public saveLibraryPanel() {
    this.state.vizManager.commitChanges();
    locationService.partial({ editPanel: null });
  }
}

export function buildPanelEditScene(panel: VizPanel): PanelEditor {
  return new PanelEditor({
    panelId: getPanelIdForVizPanel(panel),
    optionsPane: new PanelOptionsPane({}),
    vizManager: VizPanelManager.createFor(panel),
  });
}
