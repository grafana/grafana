import { SceneDataLayerProvider, dataLayers } from '@grafana/scenes';
import { AnnotationQuery } from '@grafana/schema';

export function dataLayersToAnnotations(layers: SceneDataLayerProvider[]) {
  const annotations: AnnotationQuery[] = [];
  for (const layer of layers) {
    if (!(layer instanceof dataLayers.AnnotationsDataLayer)) {
      continue;
    }

    const { datasource, builtIn, ...query } = layer.state.query || {};

    const result: AnnotationQuery = {
      ...query,
      enable: Boolean(layer.state.isEnabled),
      hide: Boolean(layer.state.isHidden),
      placement: layer.state.placement,
    };

    // Only include builtIn if it's truthy (1 or true)
    if (builtIn) {
      result.builtIn = builtIn;
    }

    // Only include datasource if it is present and non-empty
    if (datasource && Object.keys(datasource).length > 0 && (datasource.uid || datasource.type)) {
      result.datasource = datasource;
    }

    annotations.push(result);
  }

  return annotations;
}
