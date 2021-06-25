import { MapLayerRegistryItem, MapLayerConfig } from '@grafana/data';
import Map from 'ol/Map';
import TileLayer from 'ol/layer/Tile';
import Stamen from 'ol/source/Stamen';

// See:
// http://maps.stamen.com/
// for more options

const terrain: MapLayerRegistryItem = {
  id: 'stamen-terrain',
  name: 'Stamen - Terrain',
  isBaseMap: true,

  /**
   * Function that configures transformation and returns a transformer
   * @param options
   */
  create: (map: Map, options: MapLayerConfig) => ({
    init: () => {
      return new TileLayer({
        source: new Stamen({
          layer: 'terrain',
        }),
      });
    },
  }),
};

const toner: MapLayerRegistryItem = {
  id: 'stamen-toner',
  name: 'Stamen - Toner',
  isBaseMap: true,

  /**
   * Function that configures transformation and returns a transformer
   * @param options
   */
  create: (map: Map, options: MapLayerConfig) => ({
    init: () => {
      return new TileLayer({
        source: new Stamen({
          layer: 'toner',
        }),
      });
    },
  }),
};

export const stamenLayers = [toner, terrain];
