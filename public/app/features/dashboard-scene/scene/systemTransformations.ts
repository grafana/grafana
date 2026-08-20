import { type ResolvedSystemTransformations } from '@grafana/data';
import { isSystemTransformation, type SceneDataTransformation } from '@grafana/scenes';

/**
 * Stable identity for "nothing registered", so consumers using these arrays as effect deps do not
 * churn on every render.
 */
export const NO_SYSTEM_TRANSFORMATIONS: Readonly<ResolvedSystemTransformations> = {
  prepend: [],
  append: [],
};

/**
 * Splits a transformer's list into the runtime (read-only) groups and the user-configured ones.
 *
 * Placement is read off `position` rather than the array index: with no user transformations the two
 * system groups are adjacent, so position is the only thing that distinguishes them.
 */
export function splitSystemTransformations(transformations: SceneDataTransformation[]): {
  systemPrepend: SceneDataTransformation[];
  userTransformations: SceneDataTransformation[];
  systemAppend: SceneDataTransformation[];
} {
  const systemPrepend: SceneDataTransformation[] = [];
  const userTransformations: SceneDataTransformation[] = [];
  const systemAppend: SceneDataTransformation[] = [];

  for (const transformation of transformations) {
    if (!isSystemTransformation(transformation)) {
      userTransformations.push(transformation);
    } else if (transformation.position === 'append') {
      systemAppend.push(transformation);
    } else {
      systemPrepend.push(transformation);
    }
  }

  return { systemPrepend, userTransformations, systemAppend };
}

export function getUserTransformations(transformations: SceneDataTransformation[]): SceneDataTransformation[] {
  return transformations.filter((transformation) => !isSystemTransformation(transformation));
}
