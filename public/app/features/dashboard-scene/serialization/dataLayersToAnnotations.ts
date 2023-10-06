import { SceneDataLayerProvider, dataLayers } from '@grafana/scenes';
import { AnnotationQuery } from '@grafana/schema';
import { annotationsFromDataFrames } from 'app/features/query/state/DashboardQueryRunner/utils';

export function dataLayersToAnnotations(layers: SceneDataLayerProvider[], isSnapshot = false) {
  const annotations: AnnotationQuery[] = [];
  for (const layer of layers) {
    if (!(layer instanceof dataLayers.AnnotationsDataLayer)) {
      continue;
    }
    const result = {
      ...layer.state.query,
      enable: Boolean(layer.state.isEnabled),
      hide: Boolean(layer.state.isHidden),
    };
    if (isSnapshot) {
      result.snapshotData = annotationsFromDataFrames(layer.state.data?.annotations).map((e) => {
        const { source, ...rest } = e;

        return rest;
      });
    }
    annotations.push(result);
  }

  return annotations;
}
