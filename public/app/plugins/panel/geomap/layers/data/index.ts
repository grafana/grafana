import { geojsonMapper } from './geojsonMapper';
import { lastPointTracker } from './lastPointTracker';
import { worldmapBehaviorLayer } from './worldmapBehavior';

/**
 * Registry for layer handlers
 */
export const dataLayers = [
    worldmapBehaviorLayer, // mimic the existing worldmap
    lastPointTracker,
    geojsonMapper, // dummy for now
];
