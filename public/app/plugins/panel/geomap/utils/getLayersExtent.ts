import { createEmpty, extend, Extent } from 'ol/extent';
import LayerGroup from 'ol/layer/Group';
import VectorLayer from 'ol/layer/Vector';
import VectorImage from 'ol/layer/VectorImage';
import WebGLPointsLayer from 'ol/layer/WebGLPoints.js';

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
      const layerName = ll.options.name;
      const l = ll.layer;
      if (l instanceof LayerGroup) {
        // If not all layers check for matching layer name
        if (!allLayers && layerName !== layer) {
          return [];
        }
        return getLayerGroupExtent(l, lastOnly);
      } else if (l instanceof VectorLayer || l instanceof VectorImage) {
        if (allLayers) {
          // Return everything from all layers
          return [l.getSource().getExtent()];
        } else if (lastOnly && layer === layerName) {
          // Return last only for selected layer
          const feat = l.getSource().getFeatures();
          const featOfInterest = feat[feat.length - 1];
          const geo = featOfInterest?.getGeometry();
          if (geo) {
            return [geo.getExtent()];
          }
          return [];
        } else if (!lastOnly && layer === layerName) {
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

export function getLayerGroupExtent(lg: LayerGroup, lastOnly: boolean) {
  return lg
    .getLayers()
    .getArray()
    .filter((l) => l instanceof VectorLayer || l instanceof VectorImage || l instanceof WebGLPointsLayer)
    .map((l) => {
      if (l instanceof VectorLayer || l instanceof VectorImage || l instanceof WebGLPointsLayer) {
        if (lastOnly) {
          // Return last coordinate only
          const feat = l.getSource().getFeatures();
          const featOfInterest = feat[feat.length - 1];
          const geo = featOfInterest?.getGeometry();
          if (geo) {
            // Look at flatCoordinates for more robust support including route layer
            const flatCoordinates = geo.flatCoordinates;
            const flatCoordinatesLength = flatCoordinates.length;
            if (flatCoordinatesLength > 1) {
              const lastX = flatCoordinates[flatCoordinatesLength - 2];
              const lastY = flatCoordinates[flatCoordinatesLength - 1];
              return [lastX, lastY, lastX, lastY];
            }
          }
          return [];
        }
        return l.getSource().getExtent() ?? [];
      } else {
        return [];
      }
    });
}
