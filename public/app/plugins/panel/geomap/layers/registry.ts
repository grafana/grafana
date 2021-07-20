import { MapLayerOptions, MapLayerRegistryItem, Registry } from '@grafana/data';
import { Map } from 'ol';
import { get as lodashGet, set as lodashSet } from 'lodash';

import { basemapLayers } from './basemaps';
import { dataLayers } from './data';
import { config } from '@grafana/runtime';

/**
 * Registry for layer handlers
 */
export const geomapLayerRegistry = new Registry<MapLayerRegistryItem<any>>(() => [
  ...basemapLayers, // simple basemaps
  ...dataLayers, // Layers with update functions
]);

export function createLayerHandler(map: Map, options: MapLayerOptions) {
  const item = geomapLayerRegistry.getIfExists(options.type);
  if (!item) {
    return undefined;
  }

  if (item.defaultOptions) {
    options.config = {
      ...item.defaultOptions,
      ...options.config,
    };
  }

  return item.create(map, options, config.theme2);
}
