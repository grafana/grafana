import { sceneGraph, type SceneQueryControllerEntry } from '@grafana/scenes';
import { isRenderTarget } from 'app/features/dashboard/services/isRenderTarget';

import { MAX_READINESS_HOLD_MS } from './constants';

export interface RenderReadinessHold {
  release(): void;
  readonly released: boolean;
}

/**
 * Keeps the image renderer waiting until the frame has drawn. The hold is a 'plugin' entry on the
 * scene query controller, which also counts in window.__grafanaRunningQueryCount, so the existing
 * dashboard render-complete signal fires only after every hold is released.
 */
export function holdRenderReadiness(options: { maxHoldMs?: number } = {}): RenderReadinessHold {
  if (!isRenderTarget()) {
    return createNoopHold();
  }
  const scene = window.__grafanaSceneContext;
  if (!scene) {
    return createNoopHold();
  }
  const controller = sceneGraph.getQueryController(scene);
  if (!controller) {
    return createNoopHold();
  }

  let released = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const hold: RenderReadinessHold = {
    release() {
      if (released) {
        return;
      }
      released = true;
      clearTimeout(timer);
      controller.queryCompleted(entry);
    },
    get released() {
      return released;
    },
  };
  const entry: SceneQueryControllerEntry = { type: 'plugin', origin: scene, cancel: () => hold.release() };
  controller.queryStarted(entry);
  timer = setTimeout(() => hold.release(), options.maxHoldMs ?? MAX_READINESS_HOLD_MS);
  return hold;
}

function createNoopHold(): RenderReadinessHold {
  let released = false;
  return {
    release() {
      released = true;
    },
    get released() {
      return released;
    },
  };
}
