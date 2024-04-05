import { SceneObjectBase, SceneObjectState, SceneQueryRunner, VizPanel } from '@grafana/scenes';
import { SHARED_DASHBOARD_QUERY } from 'app/plugins/datasource/dashboard';

import { findVizPanelByKey, getDashboardSceneFor, getQueryRunnerFor, getVizPanelKeyForPanelId } from '../utils/utils';

interface DashboardDatasourceBehaviourState extends SceneObjectState {}

export class DashboardDatasourceBehaviour extends SceneObjectBase<DashboardDatasourceBehaviourState> {
  private prevRequestId: string | undefined;
  public constructor(state: DashboardDatasourceBehaviourState) {
    super(state);

    this.addActivationHandler(() => this._activationHandler());
  }

  private _activationHandler() {
    const queryRunner = this.parent;

    if (!(queryRunner instanceof SceneQueryRunner)) {
      throw new Error('DashboardDatasourceBehaviour must be attached to a SceneQueryRunner');
    }
    if (queryRunner.state.datasource?.uid !== SHARED_DASHBOARD_QUERY) {
      return;
    }

    const panelId = queryRunner.state.queries[0].panelId;

    const vizKey = getVizPanelKeyForPanelId(panelId);
    const dashboard = getDashboardSceneFor(queryRunner);
    const panel = findVizPanelByKey(dashboard, vizKey);

    if (!(panel instanceof VizPanel)) {
      return;
    }

    const sourcePanelQueryRunner = getQueryRunnerFor(panel);

    if (!(sourcePanelQueryRunner instanceof SceneQueryRunner)) {
      throw new Error('Could not find SceneQueryRunner for panel');
    }

    if (this.prevRequestId) {
      if (this.prevRequestId !== sourcePanelQueryRunner.state.data?.request?.requestId) {
        console.log('Request ID changed, running queries');
        queryRunner.runQueries();
      } else {
        console.log('Request ID did not change, skipping queries');
      }
    } else {
      console.log('No previous request ID, not running queries');
    }

    return () => {
      this.prevRequestId = sourcePanelQueryRunner.state.data?.request?.requestId;
    };
  }
}
