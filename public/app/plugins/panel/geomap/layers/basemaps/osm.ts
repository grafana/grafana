import { MapLayerRegistryItem, MapLayerOptions } from '@grafana/data';
import Map from 'ol/Map';
import OSM from 'ol/source/OSM';
import TileLayer from 'ol/layer/Tile';

export const standard: MapLayerRegistryItem = {
  id: 'osm-standard',
  name: 'Open Street Map',
  isBaseMap: true,

  /**
   * Function that configures transformation and returns a transformer
   * @param options
   */
  create: (map: Map, options: MapLayerOptions) => ({
    init: () => {
      return new TileLayer({
        source: new OSM(),
      });
    },
  }),
};

export const osmLayers = [standard];
