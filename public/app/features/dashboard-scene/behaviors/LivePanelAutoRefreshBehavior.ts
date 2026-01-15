import { LoadingState } from '@grafana/data';
import { SceneQueryRunner, sceneGraph } from '@grafana/scenes';

import { DashboardScene } from '../scene/DashboardScene';

/**
 * Behavior that cancels all streaming queries when auto refresh is set to "Off"
 * and connectLiveToAutoRefresh is enabled on the dashboard.
 */
export function livePanelAutoRefreshBehavior(dashboard: DashboardScene) {
  const controls = dashboard.state.controls;
  if (!controls) {
    return;
  }

  const refreshPicker = controls.state.refreshPicker;

  const cancelStreamingQueries = () => {
    const connectLiveToAutoRefresh = dashboard.state.connectLiveToAutoRefresh ?? false;
    const refresh = refreshPicker.state.refresh ?? '';

    // When connectLiveToAutoRefresh is enabled and refresh is Off (empty string),
    // cancel all streaming queries
    if (connectLiveToAutoRefresh && refresh === '') {
      // Find all SceneQueryRunner instances and cancel their queries
      sceneGraph
        .findAllObjects(
          dashboard,
          (obj) => obj instanceof SceneQueryRunner && obj.state.data?.state === LoadingState.Streaming
        )
        .forEach((obj) => {
          if (obj instanceof SceneQueryRunner) {
            obj.cancelQuery();
          }
        });
    }
  };

  // Subscribe to refresh picker state changes
  const sub = refreshPicker.subscribeToState((newState, oldState) => {
    if (newState.refresh !== oldState.refresh) {
      cancelStreamingQueries();
    }
  });

  return () => {
    sub.unsubscribe();
  };
}
