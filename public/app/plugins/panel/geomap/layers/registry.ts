import { MapLayerRegistryItem, Registry, MapLayerOptions, GrafanaTheme2 } from '@grafana/data';
import Map from 'ol/Map';
import { carto } from './basemaps/carto';
import { config } from 'app/core/config';
import { basemapLayers } from './basemaps';
import { dataLayers } from './data';

export const DEFAULT_BASEMAP_CONFIG: MapLayerOptions = {
  type: 'default',
  config: {},
};

// Default base layer depending on the server setting
export const defaultBaseLayer: MapLayerRegistryItem = {
  id: DEFAULT_BASEMAP_CONFIG.type,
  name: 'Default base layer',
  isBaseMap: true,

  create: (map: Map, options: MapLayerOptions, theme: GrafanaTheme2) => {
    const serverLayerType = config?.geomapDefaultBaseLayerConfig?.type;
    if (serverLayerType) {
      const layer = geomapLayerRegistry.getIfExists(serverLayerType);
      if (!layer) {
        throw new Error('Invalid basemap configuraiton on server');
      }
      return layer.create(map, config.geomapDefaultBaseLayerConfig!, theme);
    }

    // For now use carto as our default basemap
    return carto.create(map, options, theme);
  },
};

/**
 * Registry for layer handlers
 */
export const geomapLayerRegistry = new Registry<MapLayerRegistryItem<any>>(() => [
  defaultBaseLayer,
  ...basemapLayers, // simple basemaps
  ...dataLayers, // Layers with update functions
]);
