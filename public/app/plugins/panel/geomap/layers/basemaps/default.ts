import { MapLayerRegistryItem, MapLayerOptions, GrafanaTheme2 } from '@grafana/data';
import Map from 'ol/Map';
import { carto } from './carto';
import { esriXYZTiles } from './esri';
import { xyzTiles } from './generic';
import { standard } from './osm';
import { config } from 'app/core/config';

// Array of base map options to search through
const baseMapOptions = [carto, esriXYZTiles, xyzTiles, standard];

// Default base layer depending on the server setting
// Use CartoDB if the default base layer is not set in defaults.ini
export const defaultBaseLayer: MapLayerRegistryItem<any> = {
  id: 'default',
  name: 'Default base layer',
  isBaseMap: true,

  create: (map: Map, options: MapLayerOptions, theme: GrafanaTheme2) => ({
    init: () => {
      // Config options set on the server side
      const cfg = config.defaultBaseLayer.config;
      let defaultMap;

      // If default base layer is set, create the default base map with its corresponding config
      if (config.defaultBaseLayer.type) {
        defaultMap = baseMapOptions.find((baseLayer) => baseLayer.id === config.defaultBaseLayer.type);
        if (defaultMap === undefined) {
          throw new Error('Invalid default base map');
        }
      } else {
        defaultMap = carto;
      }
      return defaultMap.create(map, { ...options, config: cfg }, theme).init();
    },
  }),
};
