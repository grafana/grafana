import * as H from 'history';

import { NavIndex } from '@grafana/data';
import { locationService } from '@grafana/runtime';
import {
  getUrlSyncManager,
  SceneFlexItem,
  SceneFlexLayout,
  SceneGridItem,
  SceneObject,
  SceneObjectBase,
  SceneObjectRef,
  SceneObjectState,
  sceneUtils,
  SplitLayout,
  VizPanel,
} from '@grafana/scenes';
import { getDashboardSrv } from 'app/features/dashboard/services/DashboardSrv';

import { DashboardScene } from '../scene/DashboardScene';
import { DashboardModelCompatibilityWrapper } from '../utils/DashboardModelCompatibilityWrapper';
import { getDashboardUrl } from '../utils/urlBuilders';

import { PanelDataPane } from './PanelDataPane/PanelDataPane';
import { PanelEditorRenderer } from './PanelEditorRenderer';
import { PanelEditorUrlSync } from './PanelEditorUrlSync';
import { PanelOptionsPane } from './PanelOptionsPane';
import { VizPanelManager } from './VizPanelManager';

export interface PanelEditorState extends SceneObjectState {
  body: SceneObject;
  controls?: SceneObject[];
  isDirty?: boolean;
  /** Panel to inspect */
  inspectPanelKey?: string;
  /** Scene object that handles the current drawer */
  overlay?: SceneObject;

  dashboardRef: SceneObjectRef<DashboardScene>;
  sourcePanelRef: SceneObjectRef<VizPanel>;
  panelRef: SceneObjectRef<VizPanelManager>;
}

export class PanelEditor extends SceneObjectBase<PanelEditorState> {
  static Component = PanelEditorRenderer;

  /**
   * Handles url sync
   */
  protected _urlSync = new PanelEditorUrlSync(this);

  public constructor(state: PanelEditorState) {
    super(state);

    this.addActivationHandler(() => this._activationHandler());
  }

  private _activationHandler() {
    const oldDashboardWrapper = new DashboardModelCompatibilityWrapper(this.state.dashboardRef.resolve());
    // @ts-expect-error
    getDashboardSrv().setCurrent(oldDashboardWrapper);

    // Deactivation logic
    return () => {
      getUrlSyncManager().cleanUp(this);
    };
  }

  public startUrlSync() {
    getUrlSyncManager().initSync(this);
  }

  public getPageNav(location: H.Location, navIndex: NavIndex) {
    return {
      text: 'Edit panel',
      parentItem: this.state.dashboardRef.resolve().getPageNav(location, navIndex),
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

    if (!dashboard.state.isEditing) {
      dashboard.onEnterEditMode();
    }

    const panelMngr = this.state.panelRef.resolve();

    if (sourcePanel.parent instanceof SceneGridItem) {
      sourcePanel.parent.setState({ body: panelMngr.state.panel.clone() });
    }

    // preserve time range and variables state
    dashboard.setState({
      $timeRange: this.state.$timeRange?.clone(),
      $variables: this.state.$variables?.clone(),
      isDirty: true,
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

  const vizPanelMgr = new VizPanelManager(panelClone);
  const dashboardStateCloned = sceneUtils.cloneSceneObjectState(dashboard.state);

  return new PanelEditor({
    dashboardRef: dashboard.getRef(),
    sourcePanelRef: panel.getRef(),
    panelRef: vizPanelMgr.getRef(),
    controls: dashboardStateCloned.controls,
    $variables: dashboardStateCloned.$variables,
    $timeRange: dashboardStateCloned.$timeRange,
    body: new SplitLayout({
      direction: 'row',
      primary: new SplitLayout({
        direction: 'column',
        primary: new SceneFlexLayout({
          direction: 'column',
          minHeight: 200,
          children: [vizPanelMgr],
        }),
        secondary: new SceneFlexItem({
          body: new PanelDataPane(vizPanelMgr),
        }),
      }),
      secondary: new SceneFlexItem({
        body: new PanelOptionsPane(vizPanelMgr),
        width: '100%',
      }),
    }),
  });
}
