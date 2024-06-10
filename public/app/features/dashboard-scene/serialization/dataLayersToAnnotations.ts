import { SceneDataLayerProvider, dataLayers } from '@grafana/scenes';
import { AnnotationQuery } from '@grafana/schema';

export function dataLayersToAnnotations(layers: SceneDataLayerProvider[]) {
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

    annotations.push(result);
  }

  return annotations;
}
