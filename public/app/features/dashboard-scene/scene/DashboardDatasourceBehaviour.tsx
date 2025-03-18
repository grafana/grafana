import { Unsubscribable } from 'rxjs';

import { SceneObjectBase, SceneObjectState, SceneQueryRunner, VizPanel } from '@grafana/scenes';
import { SHARED_DASHBOARD_QUERY } from 'app/plugins/datasource/dashboard/constants';
import { MIXED_DATASOURCE_NAME } from 'app/plugins/datasource/mixed/MixedDataSource';

import {
  findVizPanelByKey,
  getDashboardSceneFor,
  getLibraryPanelBehavior,
  getQueryRunnerFor,
  getVizPanelKeyForPanelId,
} from '../utils/utils';

import { DashboardScene } from './DashboardScene';
import { LibraryPanelBehaviorState } from './LibraryPanelBehavior';

interface DashboardDatasourceBehaviourState extends SceneObjectState {}

export class DashboardDatasourceBehaviour extends SceneObjectBase<DashboardDatasourceBehaviourState> {
  private prevRequestId: string | undefined;
  public constructor(state: DashboardDatasourceBehaviourState) {
    super(state);

    this.addActivationHandler(() => this._activationHandler());
  }

  private _activationHandler() {
    const queryRunner = this.parent;
    let libraryPanelSub: Unsubscribable;
    let dashboard: DashboardScene;
    if (!(queryRunner instanceof SceneQueryRunner)) {
      throw new Error('DashboardDatasourceBehaviour must be attached to a SceneQueryRunner');
    }

    if (!this.containsDashboardDSQueries(queryRunner)) {
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

    // find the source panel referenced in the the dashboard ds query
    const panelId = dashboardQuery.panelId;
    const vizKey = getVizPanelKeyForPanelId(panelId);
    const sourcePanel = findVizPanelByKey(dashboard, vizKey);

    if (!(sourcePanel instanceof VizPanel)) {
      return;
    }

    //check if the source panel is a library panel and wait for it to load
    const libraryPanelBehaviour = getLibraryPanelBehavior(sourcePanel);
    if (libraryPanelBehaviour && !libraryPanelBehaviour.state.isLoaded) {
      libraryPanelSub = libraryPanelBehaviour.subscribeToState((newLibPanel) => {
        this.handleLibPanelStateUpdates(newLibPanel, queryRunner, sourcePanel);
      });
      return;
    }

    const sourcePanelQueryRunner = getQueryRunnerFor(sourcePanel);

    if (!sourcePanelQueryRunner) {
      throw new Error('Could not find SceneQueryRunner for panel');
    }

    if (this.prevRequestId && this.prevRequestId !== sourcePanelQueryRunner.state.data?.request?.requestId) {
      queryRunner.runQueries();
    }

    return () => {
      this.prevRequestId = sourcePanelQueryRunner?.state.data?.request?.requestId;
      if (libraryPanelSub) {
        libraryPanelSub.unsubscribe();
      }
    };
  }

  private containsDashboardDSQueries(queryRunner: SceneQueryRunner): boolean {
    if (queryRunner.state.datasource?.uid === SHARED_DASHBOARD_QUERY) {
      return true;
    }

    if (
      queryRunner.state.datasource?.uid === MIXED_DATASOURCE_NAME &&
      queryRunner.state.queries.some((query) => query.datasource?.uid === SHARED_DASHBOARD_QUERY)
    ) {
      return true;
    }

    return false;
  }

  private handleLibPanelStateUpdates(
    newLibPanel: LibraryPanelBehaviorState,
    dashboardDsQueryRunner: SceneQueryRunner,
    sourcePanel: VizPanel
  ) {
    if (newLibPanel && newLibPanel?.isLoaded) {
      const libPanelQueryRunner = getQueryRunnerFor(sourcePanel);

      if (!(libPanelQueryRunner instanceof SceneQueryRunner)) {
        throw new Error('Could not find SceneQueryRunner for library panel');
      }
      dashboardDsQueryRunner.runQueries();
    }
  }
}
