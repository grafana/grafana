import type OpenLayersMap from 'ol/Map';
import TileLayer from 'ol/layer/Tile';
import OSM from 'ol/source/OSM';

import { type MapLayerRegistryItem, type MapLayerOptions, type EventBus } from '@grafana/data';

export const standard: MapLayerRegistryItem = {
  id: 'osm-standard',
  name: 'OpenStreetMap',
  description: 'Add map from a collaborative free geographic world database',
  isBaseMap: true,

  /**
   * Function that configures transformation and returns a transformer
   * @param options
   */
  create: async (map: OpenLayersMap, options: MapLayerOptions, eventBus: EventBus) => ({
    init: () => {
      const noRepeat = options.noRepeat ?? false;

      return new TileLayer({
        source: new OSM({ wrapX: !noRepeat }),
      });
    },
  }),
};

export const osmLayers = [standard];
