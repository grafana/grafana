import { MapLayerRegistryItem, MapLayerConfig } from '@grafana/data';
import Map from 'ol/Map';
import XYZ from 'ol/source/XYZ';
import TileLayer from 'ol/layer/Tile';

// https://carto.com/help/building-maps/basemap-list/

const dark: MapLayerRegistryItem = {
  id: 'carto-dark',
  name: 'Carto Dark',
  isBaseMap: true,

  /**
   * Function that configures transformation and returns a transformer
   * @param options
   */
  create: (map: Map, options: MapLayerConfig) => ({
    init: () => {
      return new TileLayer({
        source: new XYZ({
          attributions: `<a href="https://carto.com/about-carto/">CARTO</a>`,
          url: `https://{1-4}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png`,
        }),
      });
    },
  }),
};

const light: MapLayerRegistryItem = {
  id: 'carto-light',
  name: 'Carto Light',
  isBaseMap: true,

  /**
   * Function that configures transformation and returns a transformer
   * @param options
   */
  create: (map: Map, options: MapLayerConfig) => ({
    init: () => {
      return new TileLayer({
        source: new XYZ({
          attributions: `<a href="https://carto.com/about-carto/">CARTO</a>`,
          url: `https://{1-4}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png`,
        }),
      });
    },
  }),
};

export const cartoLayers = [light, dark];
