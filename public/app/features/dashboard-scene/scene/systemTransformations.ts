import {
  type CustomTransformOperator,
  type DataTransformerConfig,
  type ResolvedSystemTransformations,
} from '@grafana/data';
import { FlagKeys, getFeatureFlagClient } from '@grafana/runtime/internal';
import {
  type ResolvedSystemTransformations as ResolvedSceneTransformations,
  type SceneDataTransformer,
  type SystemTransformation,
} from '@grafana/scenes';

/**
 * Stable identity for "nothing to run"
 */
export const NO_SYSTEM_TRANSFORMATIONS: Readonly<ResolvedSystemTransformations> = {
  prepend: [],
  append: [],
};

export function pluginTransformationsEnabled(): boolean {
  return getFeatureFlagClient().getBooleanValue(FlagKeys.GrafanaPanelPluginTransformations, false);
}

/** Keyed on what scenes returned, which is memoized per pass — see {@link getResolvedSystemTransformations}. */
const unwrappedByResolved = new WeakMap<ResolvedSceneTransformations, ResolvedSystemTransformations>();

/**
 * The system transformations the panel's pipeline is currently running, in the shape the plugin registered them.
 */
export function getResolvedSystemTransformations(transformer: SceneDataTransformer): ResolvedSystemTransformations {
  const resolved = transformer.getResolvedSystemTransformations();
  const unwrapped = unwrappedByResolved.get(resolved);

  if (unwrapped) {
    return unwrapped;
  }

  const result =
    resolved.prepend.length === 0 && resolved.append.length === 0
      ? NO_SYSTEM_TRANSFORMATIONS
      : { prepend: resolved.prepend.map(asRegistered), append: resolved.append.map(asRegistered) };

  unwrappedByResolved.set(resolved, result);

  return result;
}

/**
 * Scenes normalizes a custom operator into `{ operator, topic }` so it can tag it with an origin.
 * Readers want it back the way the plugin wrote it.
 */
function asRegistered(transformation: SystemTransformation): DataTransformerConfig | CustomTransformOperator {
  return 'operator' in transformation ? transformation.operator : transformation;
}
