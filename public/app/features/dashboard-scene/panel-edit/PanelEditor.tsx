import * as H from 'history';

import { locationService } from '@grafana/runtime';
import {
  SceneFlexItem,
  SceneFlexLayout,
  SceneObject,
  SceneObjectBase,
  SceneObjectRef,
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

  dashboard: SceneObjectRef<DashboardScene>;
  sourcePanel: SceneObjectRef<VizPanel>;
  panel: SceneObjectRef<VizPanel>;
}

export class PanelEditor extends SceneObjectBase<PanelEditorState> {
  static Component = PanelEditorRenderer;

  public getPageNav(location: H.Location) {
    return {
      text: 'Edit panel',
      parentItem: this.state.dashboard.resolve().getPageNav(location),
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
    const dashboard = this.state.dashboard.resolve();
    const sourcePanel = this.state.sourcePanel.resolve();
    const panel = this.state.panel.resolve();

    if (dashboard.state.isEditing) {
      dashboard.setState({ isEditing: true });
    }

    const newState = sceneUtils.cloneSceneObjectState(panel.state);

    sourcePanel.setState(newState);

    // preserve time range and variables state
    dashboard.setState({
      $timeRange: this.state.$timeRange?.clone(),
      $variables: this.state.$variables?.clone(),
    });
  }

  private navigateBackToDashboard() {
    locationService.push(
      getDashboardUrl({
        uid: this.state.dashboard.resolve().state.uid,
        currentQueryParams: locationService.getLocation().search,
      })
    );
  }
}

export function buildPanelEditScene(dashboard: DashboardScene, panel: VizPanel): PanelEditor {
  const panelClone = panel.clone();
  const dashboardStateCloned = sceneUtils.cloneSceneObjectState(dashboard.state);

  return new PanelEditor({
    dashboard: new SceneObjectRef(dashboard),
    sourcePanel: new SceneObjectRef(panel),
    panel: new SceneObjectRef(panelClone),
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
  });
}
