import { MapLayerRegistryItem, MapLayerOptions, GrafanaTheme2 } from '@grafana/data';
import Map from 'ol/Map';
import { carto } from './carto';
import { esriXYZTiles } from './esri';
import { xyzTiles } from './generic';
import { standard } from './osm';
import { config } from 'app/core/config';

// Array of base map options to search through
const baseLayers = [carto, esriXYZTiles, xyzTiles, standard];

// Configured base map from the server side
const defaultBaseLayer = config.geomapDefaultBaseLayer;

// Default base layer depending on the server setting
export const defaultLayers: MapLayerRegistryItem<any> = {
  id: 'default',
  name: 'Default base layer',
  isBaseMap: true,

  create: (map: Map, options: MapLayerOptions, theme: GrafanaTheme2) => ({
    init: () => {
      let baseLayer;

      // If default base layer is set, create the default base map with its corresponding config
      if (defaultBaseLayer) {
        baseLayer = baseLayers.find((baseLayer) => baseLayer.id === defaultBaseLayer.type);
        if (baseLayer === undefined) {
          throw new Error('Invalid default base map');
        }
        return baseLayer.create(map, { ...options, config: defaultBaseLayer.config }, theme).init();
      } else {
        // Use CartoDB if the default base layer is not set in defaults.ini
        return carto.create(map, options, theme).init();
      }
    },
  }),
};
