import { LoadingState } from '@grafana/data';
import { RefreshEvent } from '@grafana/runtime';
import { SceneQueryRunner, sceneGraph } from '@grafana/scenes';
import { blockLiveStreamingService } from 'app/features/live/centrifuge/liveStreamingService';

import { DashboardScene } from '../scene/DashboardScene';

/**
 * Behavior that cancels all streaming queries when auto refresh is set to "Off"
 * and connectLiveToAutoRefresh is enabled on the dashboard.
 * Also controls the liveStreamingService to block new streams from starting.
 */
export function livePanelAutoRefreshBehavior(dashboard: DashboardScene) {
  if (!dashboard.state.connectLiveToAutoRefresh) {
    return;
  }

  const controls = dashboard.state.controls;
  if (!controls) {
    return;
  }

  // initial state
  const refreshPicker = controls.state.refreshPicker;

  const connectLiveToAutoRefresh = dashboard.state.connectLiveToAutoRefresh ?? false;
  const refresh = refreshPicker.state.refresh ?? '';
  const shouldBlock = connectLiveToAutoRefresh && refresh === '';

  // Update the service to block/unblock new live streams
  blockLiveStreamingService.setBlocked(shouldBlock);

  // Subscribe to refresh picker state changes
  const refreshSub = refreshPicker.subscribeToState((newState, oldState) => {
    if (newState.refresh !== oldState.refresh) {
      const connectLiveToAutoRefresh = dashboard.state.connectLiveToAutoRefresh ?? false;
      const refresh = refreshPicker.state.refresh ?? '';
      const shouldBlock = connectLiveToAutoRefresh && refresh === '';
      if (shouldBlock) {
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
    }
  });

  const refreshTrig = dashboard.subscribeToEvent(RefreshEvent, () => {
    blockLiveStreamingService.setBlocked(false);
  });

  return () => {
    refreshSub.unsubscribe();
    refreshTrig.unsubscribe();
    blockLiveStreamingService.setBlocked(false);
  };
}
