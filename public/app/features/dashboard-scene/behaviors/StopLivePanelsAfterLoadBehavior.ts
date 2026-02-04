import { debounce } from 'lodash';
import { Unsubscribable } from 'rxjs';

import { LoadingState } from '@grafana/data';
import { RefreshEvent } from '@grafana/runtime';
import { SceneQueryRunner, sceneGraph } from '@grafana/scenes';

import { DashboardScene } from '../scene/DashboardScene';

// magic number
const STATE_UPDATES_BEFORE_CANCEL = 5;

export function stopLivePanelsAfterLoadBehavior(dashboard: DashboardScene) {
  const streamingRunnerSubs: Unsubscribable[] = [];

  // track if subscriptions kicked off
  let watchStarted = false;

  const refreshPicker = dashboard.state.controls?.state.refreshPicker;
  const timeRange = dashboard.state.$timeRange;

  const refreshRate = refreshPicker?.state.refresh;

  // if auto refresh rate is undefined or "" (Off) stop execution
  if (refreshRate) {
    return;
  }

  let rootQueryRunnerSub: Unsubscribable | undefined;

  const handleStopStreamingQueries = debounce(() => {
    if (watchStarted) {
      rootQueryRunnerSub?.unsubscribe();
      return;
    }

    watchStarted = true;

    // need to gather all query runners at the start to account for lazy loading
    const allQueryRunners = sceneGraph.findAllObjects(dashboard, (obj) => obj instanceof SceneQueryRunner);

    for (const runner of allQueryRunners) {
      if (runner instanceof SceneQueryRunner) {
        // tick to track number of state updates
        let tick = 0;

        const sub = runner.subscribeToState((newState) => {
          // cancel sub and streaming query if limit is reached
          if (tick >= STATE_UPDATES_BEFORE_CANCEL) {
            sub.unsubscribe();
            runner.cancelQuery();
          }

          // cancel sub if not streaming query
          if (newState.data?.state !== LoadingState.Streaming) {
            sub.unsubscribe();
          }

          tick += 1;
        });

        streamingRunnerSubs.push(sub);
      }
    }
  }, 1000);

  // root query controller will change isRunning state which is a good indicator when dashboard loaded
  rootQueryRunnerSub = sceneGraph.getQueryController(dashboard)?.subscribeToState(() => {
    // handleStopStreamingQueries is debounced to account for rapid isRunning changes on first load
    handleStopStreamingQueries();
  });

  let timeRangeSub: Unsubscribable | undefined, refreshEventSub: Unsubscribable | undefined;

  // any changes from timeRangeSub or refreshEventSub (user input) will stop
  //  all of the logic related to stopping streaming queries
  timeRangeSub = timeRange?.subscribeToState(() => {
    streamingRunnerSubs.forEach((sub) => sub.unsubscribe());
    rootQueryRunnerSub?.unsubscribe();
    refreshEventSub?.unsubscribe();
    timeRangeSub?.unsubscribe();
  });

  refreshEventSub = dashboard.subscribeToEvent(RefreshEvent, () => {
    streamingRunnerSubs.forEach((sub) => sub.unsubscribe());
    rootQueryRunnerSub?.unsubscribe();
    timeRangeSub?.unsubscribe();
    refreshEventSub?.unsubscribe();
  });

  return () => {
    streamingRunnerSubs.forEach((sub) => sub.unsubscribe());
    rootQueryRunnerSub?.unsubscribe();
    refreshEventSub.unsubscribe();
    timeRangeSub?.unsubscribe();
  };
}
