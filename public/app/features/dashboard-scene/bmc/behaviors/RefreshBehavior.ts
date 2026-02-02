import { Unsubscribable } from 'rxjs';

import { sceneGraph, SceneObjectBase, SceneObjectState, SceneQueryRunner, SceneTimeRangeState } from '@grafana/scenes';

interface RefreshBehaviorState extends SceneObjectState {
  hasChanges?: boolean;
}

export class RefreshBehavior extends SceneObjectBase<RefreshBehaviorState> {
  private unsubTimeRange?: Unsubscribable;

  constructor(state: RefreshBehaviorState) {
    super(state);
    this.addActivationHandler(() => this._activationHandler());
  }

  private _activationHandler = () => {
    // Subscribe to time range changes
    const { $timeRange } = this.getRoot().state;
    this.unsubTimeRange = $timeRange?.subscribeToState((timeRange: SceneTimeRangeState) => {
      const runnablePanels = sceneGraph.findAllObjects(this.getRoot(), (o) => {
        return Boolean(o instanceof SceneQueryRunner);
      }) as SceneQueryRunner[];
      runnablePanels.forEach((panel) => {
        if (panel.state.runQueriesMode === 'manual') {
          panel.setState({
            _hasFetchedData: false, // Reset fetched data state
            runQueriesMode: 'auto',
          });
          panel.runQueries();
        }
      });
    });
    return () => {
      // Cleanup subscriptions
      this.unsubTimeRange?.unsubscribe();
    };
  };
}
