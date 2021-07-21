import { MapLayerRegistryItem, MapLayerOptions, GrafanaTheme2 } from '@grafana/data';
import Map from 'ol/Map';
import { carto } from './carto';
import { esriXYZTiles } from './esri';
import { xyzTiles } from './generic';
import { standard } from './osm';
import { config } from 'app/core/config';

// Array of base map options to search through
const baseLayers = [carto, esriXYZTiles, xyzTiles, standard];

// Default base layer depending on the server setting
export const defaultBaseLayer: MapLayerRegistryItem = {
  id: 'default',
  name: 'Default base layer',
  isBaseMap: true,

  create: (map: Map, options: MapLayerOptions, theme: GrafanaTheme2) => {
    // Use Carto as the default base layer if not set from server
    let layer: any = carto;
    if (config.geomapDefaultBaseLayer && config.geomapDefaultBaseLayer.type) {
      options = config.geomapDefaultBaseLayer; // options from server
      layer = baseLayers.find((baseLayer) => baseLayer.id === options.type);
      if (!layer) {
        throw new Error('Invalid default base map type');
      }
    }
    return layer.create(map, options, theme);
  },
};
