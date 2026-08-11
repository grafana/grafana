import { sceneGraph, type SceneQueryControllerEntry, type SceneObject } from '@grafana/scenes';
import { isRenderTarget } from 'app/features/dashboard/services/isRenderTarget';

// Safety valve for clones that never activate (e.g. hidden by conditional rendering).
// Kept below the image renderer's 30s readiness timeout so a stuck hold cannot fail a render.
export const RELEASE_FALLBACK_MS = 20_000;

// Latest hold per repeater. A re-repeat discards the previous clones, which will never
// activate, so the superseded hold must be released eagerly instead of waiting for the
// fallback timeout.
const activeHolds = new WeakMap<SceneObject, () => void>();

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
  if (!isRenderTarget()) {
    return;
  }

  const releasePrevious = activeHolds.get(origin);

  if (clones.length === 0) {
    releasePrevious?.();
    return;
  }

  const controller = sceneGraph.getQueryController(origin);
  if (!controller) {
    return;
  }

  const release = registerPendingWork('repeat', origin);
  // Register-then-release keeps the running count above zero across the swap.
  releasePrevious?.();

  let released = false;
  let fallbackTimeoutId: ReturnType<typeof setTimeout> | undefined;

  const releaseOnce = () => {
    if (!released) {
      released = true;
      clearTimeout(fallbackTimeoutId);
      release();
    }
  };

  activeHolds.set(origin, releaseOnce);

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

export function registerPendingWork(type: SceneQueryControllerEntry['type'], origin: SceneObject): () => void {
  const controller = sceneGraph.getQueryController(origin);
  if (!controller) {
    return () => {};
  }

  let released = false;

  const release = () => {
    if (released) {
      return;
    }
    released = true;
    controller.queryCompleted(entry);
  };

  const entry: SceneQueryControllerEntry = {
    type,
    origin,
    cancel: release,
  };

  controller.queryStarted(entry);

  return release;
}
