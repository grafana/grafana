import * as H from 'history';

import { locationService } from '@grafana/runtime';
import {
  getUrlSyncManager,
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

import { DashboardScene, DashboardSceneState } from '../scene/DashboardScene';
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

  dashboardRef: SceneObjectRef<DashboardScene>;
  sourcePanelRef: SceneObjectRef<VizPanel>;
  panelRef: SceneObjectRef<VizPanel>;
}

export class PanelEditor extends SceneObjectBase<PanelEditorState> {
  static Component = PanelEditorRenderer;

  public constructor(state: PanelEditorState) {
    super(state);

    this.addActivationHandler(() => this._activationHandler());
  }

  private _activationHandler() {
    // Deactivation logic
    return () => {
      getUrlSyncManager().cleanUp(this);
    };
  }

  public startUrlSync() {
    getUrlSyncManager().initSync(this);
  }

  public getPageNav(location: H.Location) {
    return {
      text: 'Edit panel',
      parentItem: this.state.dashboardRef.resolve().getPageNav(location),
    };
  }

  public onDiscard = () => {
    // Open question on what to preserve when going back
    // Preserve time range, and variables state (that might have been changed while in panel edit)
    // Preserve current panel data? (say if you just changed the time range and have new data)
    this._navigateBackToDashboard();
  };

  public onApply = () => {
    this._commitChanges();
    this._navigateBackToDashboard();
  };

  public onSave = () => {
    this._commitChanges();
    // Open dashboard save drawer
  };

  private _commitChanges() {
    const dashboard = this.state.dashboardRef.resolve();
    const sourcePanel = this.state.sourcePanelRef.resolve();
    const panel = this.state.panelRef.resolve();

    if (!dashboard.state.isEditing) {
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

  private _navigateBackToDashboard() {
    locationService.push(
      getDashboardUrl({
        uid: this.state.dashboardRef.resolve().state.uid,
        currentQueryParams: locationService.getLocation().search,
      })
    );
  }
}

export function buildPanelEditScene(dashboard: DashboardScene, panel: VizPanel): PanelEditor {
  const panelClone = panel.clone();
  const dashboardStateCloned = sceneUtils.cloneSceneObjectState(dashboard.state);

  return new PanelEditor({
    dashboardRef: new SceneObjectRef(dashboard),
    sourcePanelRef: new SceneObjectRef(panel),
    panelRef: new SceneObjectRef(panelClone),
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
