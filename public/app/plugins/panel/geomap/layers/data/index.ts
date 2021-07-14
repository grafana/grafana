import { circlesLayer } from './circlesOverlay';
import { geojsonMapper } from './geojsonMapper';
import { lastPointTracker } from './lastPointTracker';

/**
 * Registry for layer handlers
 */
export const dataLayers = [
    circlesLayer,
    lastPointTracker,
    geojsonMapper, // dummy for now
];
