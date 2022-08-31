import Map from 'ol/Map';
import TileLayer from 'ol/layer/Tile';
import OSM from 'ol/source/OSM';

import { MapLayerRegistryItem, MapLayerOptions, EventBus } from '@grafana/data';

export const standard: MapLayerRegistryItem = {
  id: 'osm-standard',
  name: 'Open Street Map',
  description: 'Add map from a collaborative free geographic world database',
  isBaseMap: true,

  /**
   * Function that configures transformation and returns a transformer
   * @param options
   */
  create: async (map: Map, options: MapLayerOptions, eventBus: EventBus) => ({
    init: () => {
      return new TileLayer({
        source: new OSM(),
      });
    },
  }),
};

export const osmLayers = [standard];
