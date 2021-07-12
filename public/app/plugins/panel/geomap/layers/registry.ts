import { MapLayerRegistryItem, Registry } from '@grafana/data';

import { basemapLayers } from './basemaps';
import { dataLayers } from './data';

/**
 * Registry for layer handlers
 */
export const geomapLayerRegistry = new Registry<MapLayerRegistryItem<any>>(() => [
  ...basemapLayers, // simple basemaps
  ...dataLayers, // Layers with update functions
]);
