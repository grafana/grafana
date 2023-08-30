import * as H from 'history';

import { locationService } from '@grafana/runtime';
import { SceneObject, SceneObjectBase, SceneObjectState, sceneUtils, VizPanel } from '@grafana/scenes';

import { DashboardScene } from '../scene/DashboardScene';
import { getDashboardUrl } from '../utils/utils';

import { PanelEditorRenderer } from './PanelEditorRenderer';

export interface PanelEditorState extends SceneObjectState {
  panel: VizPanel;
  controls?: SceneObject[];
  isDirty?: boolean;
  /** Panel to inspect */
  inspectPanelId?: string;
  /** Scene object that handles the current drawer */
  drawer?: SceneObject;
  getDashboard(): DashboardScene;
}

export class PanelEditor extends SceneObjectBase<PanelEditorState> {
  static Component = PanelEditorRenderer;

  public getPageNav(location: H.Location) {
    return {
      text: 'Edit panel',
      parentItem: this.state.getDashboard().getPageNav(location),
    };
  }

  public onDiscard = () => {
    // Open question on what to preserve when going back
    // Preserve time range, and variables state (that might have been changed while in panel edit)
    // Preserve current panel data? (say if you just changed the time range and have new data)
    this.navigateBackToDashboard();
  };

  public onApply = () => {
    // TODO handle applying changes to source dashboard state
    this.navigateBackToDashboard();
  };

  public onSave = () => {
    // Apply change
    // Open dashboard save drawer
  };

  private navigateBackToDashboard() {
    locationService.push(
      getDashboardUrl({
        uid: this.state.getDashboard().state.uid,
        currentQueryParams: locationService.getLocation().search,
      })
    );
  }
}

export function buildPanelEditScene(dashboard: DashboardScene, panel: VizPanel) {
  const panelClone = panel.clone();
  const dashboardStateCloned = sceneUtils.cloneSceneObjectState(dashboard.state);

  const panelEditor = new PanelEditor({
    panel: panelClone,
    controls: dashboardStateCloned.controls,
    $variables: dashboardStateCloned.$variables,
    $timeRange: dashboardStateCloned.$timeRange,
    getDashboard: () => dashboard,
  });

  return panelEditor;
}
