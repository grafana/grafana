import { Unsubscribable } from 'rxjs';

import { LoadingState } from '@grafana/data';
import { RefreshEvent } from '@grafana/runtime';
import { SceneQueryRunner, SceneRefreshPickerState, sceneGraph } from '@grafana/scenes';
import { blockLiveStreamingService } from 'app/features/live/centrifuge/liveStreamingService';

import { DashboardScene } from '../scene/DashboardScene';

/**
 * Behavior that cancels all streaming queries when auto refresh is set to "Off"
 * and connectLiveToAutoRefresh is enabled on the dashboard.
 * Also controls the liveStreamingService to block new streams from starting.
 */
export function livePanelAutoRefreshBehavior(dashboard: DashboardScene) {
  let autoRefreshSub: Unsubscribable | undefined,
    timeRangeSub: Unsubscribable | undefined,
    refreshEventSub: Unsubscribable | undefined;

  const settingSub = dashboard.subscribeToState((newState, oldState) => {
    if (newState.connectLiveToAutoRefresh === oldState.connectLiveToAutoRefresh) {
      return;
    }

    if (!newState.connectLiveToAutoRefresh) {
      autoRefreshSub?.unsubscribe();
      timeRangeSub?.unsubscribe();
      refreshEventSub?.unsubscribe();
    }

    const controls = dashboard.state.controls;

    autoRefreshSub = controls?.state.refreshPicker.subscribeToState((newState) =>
      handleRefreshPickerSub(newState, dashboard)
    );
    timeRangeSub = dashboard.state.$timeRange?.subscribeToState(handleRemoveBlock);
    refreshEventSub = dashboard.subscribeToEvent(RefreshEvent, handleRemoveBlock);
  });

  if (!dashboard.state.connectLiveToAutoRefresh) {
    return;
  }

  const refreshPicker = dashboard.state.controls?.state.refreshPicker;
  const timeRange = dashboard.state.$timeRange;
  const shouldBlock = !!refreshPicker && refreshPicker.state.refresh === '';

  if (shouldBlock) {
    blockLiveStreamingService.setBlocked(true);
    timeRangeSub = timeRange?.subscribeToState(handleRemoveBlock);
    refreshEventSub = dashboard.subscribeToEvent(RefreshEvent, handleRemoveBlock);
  }

  autoRefreshSub = refreshPicker?.subscribeToState((newState) => handleRefreshPickerSub(newState, dashboard));

  return () => {
    autoRefreshSub?.unsubscribe();
    refreshEventSub?.unsubscribe();
    timeRangeSub?.unsubscribe();
    settingSub.unsubscribe();
    handleRemoveBlock();
  };
}

function handleRefreshPickerSub(state: SceneRefreshPickerState, dashboard: DashboardScene) {
  if (state.refresh === '') {
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

function handleRemoveBlock() {
  blockLiveStreamingService.setBlocked(false);
}
