import { type SceneObject, SceneQueryRunner, sceneGraph } from '@grafana/scenes';
import { sendRenderComplete } from 'app/features/dashboard/services/sendRenderComplete';

// Below grafana-image-renderer's 30s readiness timeout, so a notebook whose queries never settle
// still prints, partially, instead of failing the whole export.
export const RENDER_READY_FALLBACK_MS = 20_000;

// How long to wait for a first query before deciding the notebook has none to wait for.
export const NO_QUERY_GRACE_MS = 1_000;

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
 * Calls `onReady` once the scene's queries have run and the panels have had a frame to paint, or
 * after RENDER_READY_FALLBACK_MS if they never settle. Returns a cleanup function.
 */
export function watchRenderReadiness(scene: SceneObject, onReady: () => void): () => void {
  const controller = sceneGraph.getQueryController(scene);
  let started = (controller?.runningQueriesCount() ?? 0) > 0;
  let frame: number | undefined;

  const ready = () => {
    stop();
    onReady();
  };

  const checkAfterPaint = () => {
    if (frame !== undefined) {
      return;
    }
    frame = requestAnimationFrame(() => {
      frame = undefined;
      if ((controller?.runningQueriesCount() ?? 0) === 0 && !hasQueryRunnerWithoutData(scene)) {
        ready();
      }
    });
  };

  const sub = controller?.subscribeToState((state) => {
    if (state.isRunning) {
      started = true;
    } else {
      checkAfterPaint();
    }
  });

  const graceTimer = setTimeout(() => {
    if (!started) {
      checkAfterPaint();
    }
  }, NO_QUERY_GRACE_MS);

  const fallbackTimer = setTimeout(ready, RENDER_READY_FALLBACK_MS);

  function stop() {
    sub?.unsubscribe();
    clearTimeout(graceTimer);
    clearTimeout(fallbackTimer);
    if (frame !== undefined) {
      cancelAnimationFrame(frame);
      frame = undefined;
    }
  }

  return stop;
}

// A runner registers with the query controller only once its datasource has loaded, so a quiet
// controller alone does not mean every panel has asked for its data yet.
function hasQueryRunnerWithoutData(scene: SceneObject): boolean {
  return sceneGraph
    .findAllObjects(scene, (obj) => obj instanceof SceneQueryRunner && obj.isActive)
    .some((runner) => runner instanceof SceneQueryRunner && !runner.state.data);
}
