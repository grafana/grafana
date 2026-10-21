import { type SceneObject, SceneQueryRunner, VizPanel, sceneGraph } from '@grafana/scenes';
import { sendRenderComplete } from 'app/features/dashboard/services/sendRenderComplete';

// Below grafana-image-renderer's 30s readiness timeout, so a notebook whose queries never settle
// still prints, partially, instead of failing the whole export.
export const RENDER_READY_FALLBACK_MS = 20_000;

// How long the scene has to stay free of running queries before it counts as rendered. Queries
// finishing is not the end of the work: plugins load and charts paint afterwards, and a panel that
// is slow to reach its datasource starts its query late. A query starting inside the window restarts
// it, the same way a new query cancels the dashboard profiler's tail recording.
export const RENDER_SETTLE_MS = 1_000;

/**
 * Sends the render-complete message at most once, whichever of success, fallback or failure
 * comes first. The renderer stops waiting on the first message, so later ones would be noise.
 */
export function createRenderCompleteReporter(): (success: boolean) => void {
  let sent = false;

  return (success) => {
    if (sent) {
      return;
    }
    sent = true;
    sendRenderComplete(success);
  };
}

/**
 * Calls `onReady` once the scene has had no running queries, and no panel still waiting on its plugin
 * or first data, for RENDER_SETTLE_MS, or after RENDER_READY_FALLBACK_MS if it never settles. Returns
 * a cleanup function.
 */
export function watchRenderReadiness(scene: SceneObject, onReady: () => void): () => void {
  const controller = sceneGraph.getQueryController(scene);
  let settleTimer: ReturnType<typeof setTimeout> | undefined;

  const ready = () => {
    stop();
    onReady();
  };

  const isSettled = () => (controller?.runningQueriesCount() ?? 0) === 0 && !hasPanelsStillLoading(scene);

  const scheduleSettle = () => {
    clearTimeout(settleTimer);
    settleTimer = setTimeout(() => (isSettled() ? ready() : scheduleSettle()), RENDER_SETTLE_MS);
  };

  const sub = controller?.subscribeToState((state) => {
    if (state.isRunning) {
      clearTimeout(settleTimer);
    } else {
      scheduleSettle();
    }
  });

  if ((controller?.runningQueriesCount() ?? 0) === 0) {
    scheduleSettle();
  }

  const fallbackTimer = setTimeout(ready, RENDER_READY_FALLBACK_MS);

  function stop() {
    sub?.unsubscribe();
    clearTimeout(settleTimer);
    clearTimeout(fallbackTimer);
  }

  return stop;
}

// A runner registers with the query controller only once its datasource has loaded, and a panel
// draws only once its plugin has, so a quiet controller alone does not mean everything has rendered.
function hasPanelsStillLoading(scene: SceneObject): boolean {
  return sceneGraph
    .findAllObjects(scene, (obj) => obj.isActive && (obj instanceof SceneQueryRunner || obj instanceof VizPanel))
    .some((obj) => {
      if (obj instanceof SceneQueryRunner) {
        return !obj.state.data;
      }

      return obj instanceof VizPanel && !obj.getPlugin() && !obj.state._pluginLoadError;
    });
}
