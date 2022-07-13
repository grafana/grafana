import { Collection } from 'ol';
import { createEmpty, extend, Extent } from 'ol/extent';
import BaseLayer from 'ol/layer/Base';
import LayerGroup from 'ol/layer/Group';
import VectorLayer from 'ol/layer/Vector';

export function getLayersExtent(layers: Collection<BaseLayer>): Extent {
  return layers
    .getArray()
    .filter((l) => l instanceof VectorLayer || l instanceof LayerGroup)
    .flatMap((l) => {
      if (l instanceof LayerGroup) {
        return getLayerGroupExtent(l);
      } else if (l instanceof VectorLayer) {
        return [l.getSource().getExtent()] ?? [];
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
