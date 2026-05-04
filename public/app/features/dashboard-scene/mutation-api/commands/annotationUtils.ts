/**
 * Helpers shared by annotation mutation commands.
 */

import { type AnnotationQuery } from '@grafana/data';
import { dataLayers, type SceneDataLayerProvider } from '@grafana/scenes';
import { type AnnotationQueryKind } from '@grafana/schema/apis/dashboard.grafana.app/v2';

import { DashboardAnnotationsDataLayer } from '../../scene/DashboardAnnotationsDataLayer';
import type { DashboardDataLayerSet } from '../../scene/DashboardDataLayerSet';
import type { DashboardScene } from '../../scene/DashboardScene';
import { transformV1ToV2AnnotationQuery, transformV2ToV1AnnotationQuery } from '../../serialization/annotations';
import { dashboardSceneGraph } from '../../utils/dashboardSceneGraph';

/**
 * Returns the dashboard's `DashboardDataLayerSet`. Throws when the scene has
 * no annotations layer set (should not happen on real dashboards).
 */
export function getAnnotationLayerSet(scene: DashboardScene): DashboardDataLayerSet {
  return dashboardSceneGraph.getDataLayers(scene);
}

/**
 * Find an annotation layer by its `state.name`. Returns the layer and its index
 * within `annotationLayers`, or `null` if not found.
 */
export function findAnnotationLayer(
  set: DashboardDataLayerSet,
  name: string
): { layer: SceneDataLayerProvider; index: number } | null {
  const layers = set.state.annotationLayers;
  for (let i = 0; i < layers.length; i++) {
    if (layers[i].state.name === name) {
      return { layer: layers[i], index: i };
    }
  }
  return null;
}

/**
 * Build a new `DashboardAnnotationsDataLayer` from a v2beta1 `AnnotationQueryKind`.
 *
 * Uses `transformV2ToV1AnnotationQuery` to derive the v1 `AnnotationQuery` that
 * scene layers actually store, then mirrors the layer-level fields
 * (`name`, `isEnabled`, `isHidden`, `placement`) the same way the v2 load path
 * does in `transformSaveModelSchemaV2ToScene`.
 */
export function buildAnnotationLayer(annotation: AnnotationQueryKind): DashboardAnnotationsDataLayer {
  const query: AnnotationQuery = transformV2ToV1AnnotationQuery(annotation);
  return new DashboardAnnotationsDataLayer({
    query,
    name: annotation.spec.name,
    isEnabled: Boolean(annotation.spec.enable),
    isHidden: Boolean(annotation.spec.hide),
    placement: annotation.spec.placement,
  });
}

/**
 * Replace the annotation layers list. The set's existing activation handler
 * re-subscribes when `annotationLayers !== oldState.annotationLayers`, so no
 * manual re-activation is required.
 */
export function replaceAnnotationLayers(set: DashboardDataLayerSet, layers: SceneDataLayerProvider[]): void {
  set.setState({ annotationLayers: layers });
}

/**
 * Convert a layer back to a v2beta1 `AnnotationQueryKind`. Used by `LIST_ANNOTATIONS`
 * to surface current scene state to LLM tool callers.
 *
 * Layers built outside the v2 load path may not carry full datasource type/uid
 * metadata; in that case the v1 → v2 transform falls back to whatever is stored
 * on the underlying `AnnotationQuery`. Returns `null` for unsupported layer types.
 */
export function annotationLayerToKind(layer: SceneDataLayerProvider): AnnotationQueryKind | null {
  if (!(layer instanceof dataLayers.AnnotationsDataLayer)) {
    return null;
  }
  const query = layer.state.query;
  const dsType = query.datasource?.type ?? '';
  const dsUid = query.datasource?.uid;
  return transformV1ToV2AnnotationQuery(query, dsType, dsUid, {
    enable: layer.state.isEnabled,
    hide: layer.state.isHidden,
  });
}

/**
 * `true` when the layer represents the built-in Grafana annotations entry,
 * which is auto-injected on dashboard load and cannot be removed.
 */
export function isBuiltInAnnotation(layer: SceneDataLayerProvider): boolean {
  if (!(layer instanceof dataLayers.AnnotationsDataLayer)) {
    return false;
  }
  return Boolean(layer.state.query.builtIn);
}

/**
 * `true` when any layer in the set is the built-in Grafana annotation.
 */
export function hasBuiltInAnnotation(set: DashboardDataLayerSet): boolean {
  return set.state.annotationLayers.some(isBuiltInAnnotation);
}
