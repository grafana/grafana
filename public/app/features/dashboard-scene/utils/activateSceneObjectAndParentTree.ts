import type { CancelActivationHandler, SceneObject } from '@grafana/scenes';

/**
 * Activates any inactive ancestors of the scene object.
 * Useful when rendering a scene object out of context of it's parent
 * @returns
 */
export function activateSceneObjectAndParentTree(so: SceneObject): CancelActivationHandler | undefined {
  let cancel: CancelActivationHandler | undefined;
  let parentCancel: CancelActivationHandler | undefined;

  if (so.isActive) {
    return cancel;
  }

  if (so.parent) {
    parentCancel = activateSceneObjectAndParentTree(so.parent);
  }

  cancel = so.activate();

  return () => {
    parentCancel?.();
    cancel();
  };
}
