import { MapLayerRegistryItem, MapLayerConfig } from '@grafana/data';
import Map from 'ol/Map';
import OSM from 'ol/source/OSM';
import TileLayer from 'ol/layer/Tile';

export const defaultGrafanaThemedMap: MapLayerRegistryItem = {
  id: 'grafana-theme',
  name: 'Grafana - based on theme',
  isBaseMap: true,

  /**
   * Function that configures transformation and returns a transformer
   * @param options
   */
  create: (map: Map, options: MapLayerConfig) => ({
    init: () => {
      return new TileLayer({
        source: new OSM(),
      });
    },
  }),
};
