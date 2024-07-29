import { Unsubscribable } from 'rxjs';

import {
  CancelActivationHandler,
  SceneObjectBase,
  SceneObjectState,
  SceneQueryRunner,
  VizPanel,
  VizPanelState,
} from '@grafana/scenes';
import { SHARED_DASHBOARD_QUERY } from 'app/plugins/datasource/dashboard';

import {
  findVizPanelByKey,
  getDashboardSceneFor,
  getQueryRunnerFor,
  getVizPanelKeyForPanelId,
  isLibraryPanel,
} from '../utils/utils';

import { DashboardScene } from './DashboardScene';

interface DashboardDatasourceBehaviourState extends SceneObjectState {}

export class DashboardDatasourceBehaviour extends SceneObjectBase<DashboardDatasourceBehaviourState> {
  private prevRequestId: string | undefined;
  public constructor(state: DashboardDatasourceBehaviourState) {
    super(state);

    this.addActivationHandler(() => this._activationHandler());
  }

  private _activationHandler() {
    const queryRunner = this.parent;
    let dashboard: DashboardScene;
    let libraryPanelSub: Unsubscribable;
    debugger;
    if (!(queryRunner instanceof SceneQueryRunner)) {
      throw new Error('DashboardDatasourceBehaviour must be attached to a SceneQueryRunner');
    }

    if (queryRunner.state.datasource?.uid !== SHARED_DASHBOARD_QUERY) {
      return;
    }

    try {
      dashboard = getDashboardSceneFor(queryRunner);
    } catch {
      return;
    }

    const dashboardQuery = queryRunner.state.queries.find((query) => query.panelId !== undefined);

    if (!dashboardQuery) {
      return;
    }

    const panelId = dashboardQuery.panelId;
    const vizKey = getVizPanelKeyForPanelId(panelId);
    const panel = findVizPanelByKey(dashboard, vizKey);

    if (!(panel instanceof VizPanel)) {
      return;
    }

    const sourcePanelQueryRunner = getQueryRunnerFor(panel);

    if (!sourcePanelQueryRunner) {
      throw new Error('Could not find SceneQueryRunner for panel');
    }

    let parentLibPanelCleanUp: undefined | CancelActivationHandler;

    if (isLibraryPanel(panel)) {
      if (!panel.isActive) {
        parentLibPanelCleanUp = panel.activate();
      }
      // Library panels load and create internal viz panel asynchroniously. Here we are subscribing to
      // library panel state, and run dashboard queries when the source panel query runner is ready.
      libraryPanelSub = panel.subscribeToState((n, p) => {
        this.handleLibPanelStateUpdates(n, p, queryRunner);
      });
    } else if (this.prevRequestId && this.prevRequestId !== sourcePanelQueryRunner.state.data?.request?.requestId) {
      queryRunner.runQueries();
    }

    return () => {
      this.prevRequestId = sourcePanelQueryRunner?.state.data?.request?.requestId;
    };
  }

  private handleLibPanelStateUpdates(n: VizPanelState, p: VizPanelState, queryRunner: SceneQueryRunner) {
    if (n !== p) {
      queryRunner.runQueries();
    }
  }
}
