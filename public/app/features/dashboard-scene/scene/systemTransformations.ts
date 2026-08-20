import { type CustomTransformOperator, type DataTransformerConfig } from '@grafana/data';
import { isSystemTransformation, type SceneDataTransformation } from '@grafana/scenes';

/**
 * The transformations a panel's plugin requires for a given set of query result frames, in the form
 * `transformDataFrame` accepts and split by where each group runs.
 *
 * These are the resolved configs, not the wrapper operators that carry them through the pipeline:
 * the supplier is data dependent, so they only exist once frames are in hand.
 */
export interface ResolvedSystemTransformations {
  prepend: Array<DataTransformerConfig | CustomTransformOperator>;
  append: Array<DataTransformerConfig | CustomTransformOperator>;
}

/**
 * Stable identity for "nothing registered", so consumers using these arrays as effect deps do not
 * churn on every render.
 */
export const NO_SYSTEM_TRANSFORMATIONS: ResolvedSystemTransformations = {
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
