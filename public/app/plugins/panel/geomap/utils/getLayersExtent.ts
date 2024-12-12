import { createEmpty, extend, Extent } from 'ol/extent';
import LayerGroup from 'ol/layer/Group';
import VectorLayer from 'ol/layer/Vector';
import VectorImage from 'ol/layer/VectorImage';

import { MapLayerState } from '../types';

export function getLayersExtent(
  layers: MapLayerState[] = [],
  allLayers = false,
  lastOnly = false,
  layer: string | undefined
): Extent {
  return layers
    .filter((l) => l.layer instanceof VectorLayer || l.layer instanceof LayerGroup || l.layer instanceof VectorImage)
    .flatMap((ll) => {
      const l = ll.layer;
      if (l instanceof LayerGroup) {
        return getLayerGroupExtent(l);
      } else if (l instanceof VectorLayer || l instanceof VectorImage) {
        if (allLayers) {
          // Return everything from all layers
          return [l.getSource().getExtent()];
        } else if (lastOnly && layer === ll.options.name) {
          // Return last only for selected layer
          const feat = l.getSource().getFeatures();
          const featOfInterest = feat[feat.length - 1];
          const geo = featOfInterest?.getGeometry();
          if (geo) {
            return [geo.getExtent()];
          }
          return [];
        } else if (!lastOnly && layer === ll.options.name) {
          // Return all points for selected layer
          return [l.getSource().getExtent()];
        }
        return [];
      } else {
        return [];
      }
    })
    .reduce(extend, createEmpty());
}

export function getLayerGroupExtent(lg: LayerGroup) {
  return lg
    .getLayers()
    .getArray()
    .filter((l) => l instanceof VectorLayer)
    .map((l) => {
      if (l instanceof VectorLayer) {
        return l.getSource().getExtent() ?? [];
      } else {
        return [];
      }
    });
}
