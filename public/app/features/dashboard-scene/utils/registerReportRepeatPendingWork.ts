import { sceneGraph, type SceneObject, type SceneQueryControllerLike } from '@grafana/scenes';
import { isRenderTarget } from 'app/features/dashboard/services/isRenderTarget';

// Safety valve for clones that never activate (e.g. hidden by conditional rendering).
// Kept below the image renderer's 30s readiness timeout so a stuck hold cannot fail a render.
export const RELEASE_FALLBACK_MS = 20_000;

interface PendingWorkController extends SceneQueryControllerLike {
  registerPendingWork(type: string, origin: SceneObject): () => void;
}

// Duck-typed because the currently pinned @grafana/scenes version does not expose
// registerPendingWork yet; this helper becomes active once the scenes upgrade lands.
function supportsPendingWork(controller: SceneQueryControllerLike): controller is PendingWorkController {
  return 'registerPendingWork' in controller && typeof controller.registerPendingWork === 'function';
}

/**
 * Holds the scene query controller "running" until every given repeat clone has activated
 * (React mounted it). This closes the race where the running-query count briefly hits zero
 * between a repeat variable completing and the clones registering their queries, which made
 * report readiness complete prematurely.
 *
 * Only active for image-renderer/report captures: regular dashboard viewing keeps its
 * current profiling behavior (holds would extend the refresh spinner and skew
 * dashboard_view metrics for every user).
 */
export function registerReportRepeatPendingWork(origin: SceneObject, clones: SceneObject[]): void {
  if (clones.length === 0 || !isRenderTarget()) {
    return;
  }

  const controller = sceneGraph.getQueryController(origin);
  if (!controller || !supportsPendingWork(controller)) {
    return;
  }

  const release = controller.registerPendingWork('repeat', origin);

  let released = false;
  let fallbackTimeoutId: ReturnType<typeof setTimeout> | undefined;

  const releaseOnce = () => {
    if (!released) {
      released = true;
      clearTimeout(fallbackTimeoutId);
      release();
    }
  };

  fallbackTimeoutId = setTimeout(releaseOnce, RELEASE_FALLBACK_MS);

  const releaseWhenAllActive = () => {
    if (clones.every((clone) => clone.isActive)) {
      releaseOnce();
    }
  };

  for (const clone of clones) {
    clone.addActivationHandler(releaseWhenAllActive);
  }

  // Clones may already be active when repeats are re-performed with reused objects.
  releaseWhenAllActive();
}
