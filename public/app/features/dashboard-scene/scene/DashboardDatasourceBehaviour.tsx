import { SceneObjectBase, SceneObjectState, SceneQueryRunner, VizPanel } from '@grafana/scenes';

import { findVizPanelByKey, getDashboardSceneFor, getQueryRunnerFor, getVizPanelKeyForPanelId } from '../utils/utils';

interface DashboardDatasourceBehaviourState extends SceneObjectState {}

export class DashboardDatasourceBehaviour extends SceneObjectBase<DashboardDatasourceBehaviourState> {
  public constructor(state: DashboardDatasourceBehaviourState) {
    super(state);

    this.addActivationHandler(() => this._activationHandler());
  }

  private _activationHandler() {
    const queryRunner = this.parent;

    if (!(queryRunner instanceof SceneQueryRunner)) {
      throw new Error('DashboardDatasourceBehaviour must be attached to a SceneQueryRunner');
    }

    const panelId = queryRunner.state.queries[0].panelId;

    const vizKey = getVizPanelKeyForPanelId(panelId);
    const dashboard = getDashboardSceneFor(queryRunner);
    const panel = findVizPanelByKey(dashboard, vizKey);

    if (!(panel instanceof VizPanel)) {
      throw new Error('Could not find VizPanel for panelId');
    }

    const sourcePanelQueryRunner = getQueryRunnerFor(panel);
    if (!(sourcePanelQueryRunner instanceof SceneQueryRunner)) {
      throw new Error('Could not find SceneQueryRunner for panel');
    }

    const sub = sourcePanelQueryRunner.subscribeToState(() => {
      queryRunner.cancelQuery();
      queryRunner.runQueries();
    });

    console.log('Activated dashboard datasource behaviour');

    return () => {
      sub.unsubscribe();
    };
  }
}
