import { type SceneObject } from '@grafana/scenes';

import { type NotebookScene } from './NotebookScene';

/**
 * Notebooks currently holding the global scene context, most recently activated last, and whatever
 * held it before the first of them.
 *
 * A stack rather than each activation remembering its own predecessor, because deactivation order is
 * not activation order: more than one notebook can be mounted at a time — an embedded one over
 * whatever else is open — and the naive version got both ends wrong. An older notebook closing used
 * to hand the context back while a newer one was still live, and the last one closing handed it to
 * an already-deactivated sibling, leaving panel interpolation and TimeSrv resolving against a dead
 * scene. Splicing by identity is correct for any order.
 *
 * Only notebooks are tracked. A dashboard deactivating still restores unconditionally and can take
 * the context from a live notebook; that is a pre-existing behaviour of DashboardScene and is
 * deliberately left alone here.
 */
const sceneContextStack: NotebookScene[] = [];
let beforeFirstSceneContext: SceneObject | undefined;

export function claimSceneContext(scene: NotebookScene): void {
  if (sceneContextStack.length === 0) {
    beforeFirstSceneContext = window.__grafanaSceneContext;
  }
  sceneContextStack.push(scene);
  window.__grafanaSceneContext = scene;
}

export function releaseSceneContext(scene: NotebookScene): void {
  const index = sceneContextStack.lastIndexOf(scene);
  if (index !== -1) {
    sceneContextStack.splice(index, 1);
  }
  // The newest notebook still mounted, or whatever held it before any of them.
  window.__grafanaSceneContext = sceneContextStack[sceneContextStack.length - 1] ?? beforeFirstSceneContext;
  if (sceneContextStack.length === 0) {
    beforeFirstSceneContext = undefined;
  }
}

/** The most recently mounted scene showing this notebook. Uid is read now: a draft gets one on first save. */
export function findActiveNotebookScene(uid: string): NotebookScene | undefined {
  for (let index = sceneContextStack.length - 1; index >= 0; index--) {
    if (sceneContextStack[index].state.uid === uid) {
      return sceneContextStack[index];
    }
  }
  return undefined;
}
