import * as H from 'history';

import { locationService } from '@grafana/runtime';
import {
  SceneFlexItem,
  SceneFlexLayout,
  sceneGraph,
  SceneObject,
  SceneObjectBase,
  SceneObjectState,
  sceneUtils,
  SplitLayout,
  VizPanel,
} from '@grafana/scenes';

import { DashboardScene } from '../scene/DashboardScene';
import { getDashboardUrl } from '../utils/utils';

import { PanelEditorRenderer } from './PanelEditorRenderer';
import { PanelOptionsPane } from './PanelOptionsPane';

export interface PanelEditorState extends SceneObjectState {
  body: SceneObject;
  controls?: SceneObject[];
  isDirty?: boolean;
  /** Panel to inspect */
  inspectPanelId?: string;
  /** Scene object that handles the current drawer */
  drawer?: SceneObject;
}

export class PanelEditor extends SceneObjectBase<PanelEditorState> {
  static Component = PanelEditorRenderer;

  private _dashboard: DashboardScene;
  private _sourcePanel: VizPanel;

  public constructor(dashboard: DashboardScene, panel: VizPanel) {
    super(buildPanelEditScene(dashboard, panel));

    this._dashboard = dashboard;
    this._sourcePanel = panel;
  }

  public getPageNav(location: H.Location) {
    return {
      text: 'Edit panel',
      parentItem: this._dashboard.getPageNav(location),
    };
  }

  public onDiscard = () => {
    // Open question on what to preserve when going back
    // Preserve time range, and variables state (that might have been changed while in panel edit)
    // Preserve current panel data? (say if you just changed the time range and have new data)
    this.navigateBackToDashboard();
  };

  public onApply = () => {
    this.commitChanges();
    this.navigateBackToDashboard();
  };

  public onSave = () => {
    this.commitChanges();
    // Open dashboard save drawer
  };

  private commitChanges() {
    if (!this._dashboard.state.isEditing) {
      this._dashboard.setState({ isEditing: true });
    }

    const updatedPanel = sceneGraph.findObject(this.state.body, (p) => p.state.key === this._sourcePanel.state.key)!;
    const newState = sceneUtils.cloneSceneObjectState(updatedPanel.state);

    this._sourcePanel.setState(newState);

    // preserve time range and variables state
    this._dashboard.setState({
      $timeRange: this.state.$timeRange?.clone(),
      $variables: this.state.$variables?.clone(),
    });
  }

  private navigateBackToDashboard() {
    locationService.push(
      getDashboardUrl({
        uid: this._dashboard.state.uid,
        currentQueryParams: locationService.getLocation().search,
      })
    );
  }
}

function buildPanelEditScene(dashboard: DashboardScene, panel: VizPanel): PanelEditorState {
  const panelClone = panel.clone();
  const dashboardStateCloned = sceneUtils.cloneSceneObjectState(dashboard.state);

  const state: PanelEditorState = {
    controls: dashboardStateCloned.controls,
    $variables: dashboardStateCloned.$variables,
    $timeRange: dashboardStateCloned.$timeRange,
    body: new SplitLayout({
      direction: 'row',
      primary: new SceneFlexLayout({
        direction: 'column',
        children: [panelClone],
      }),
      secondary: new SceneFlexItem({
        width: '300px',
        body: new PanelOptionsPane(panelClone),
      }),
    }),
  };

  return state;
}
