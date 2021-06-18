import { MapLayerRegistryItem, Registry } from '@grafana/data';

// import L from 'leaflet';
// import * as EL from 'esri-leaflet';

import { basemapLayers } from './basemaps';

/**
 * Registry for layer handlers
 */
export const geomapLayerRegistry = new Registry<MapLayerRegistryItem<any>>(() => [...basemapLayers]);
