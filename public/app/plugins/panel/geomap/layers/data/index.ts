import { markersLayer } from './markersLayer';
import { geojsonMapper } from './geojsonMapper';
import { lastPointTracker } from './lastPointTracker';

/**
 * Registry for layer handlers
 */
export const dataLayers = [
    markersLayer,
    lastPointTracker,
    geojsonMapper, // dummy for now
];
