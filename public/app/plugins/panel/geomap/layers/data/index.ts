<<<<<<< HEAD
import { geojsonMapper } from './geojsonMapper';
import { lastPointTracker } from './lastPointTracker';
import { worldmapBehaviorLayer } from './worldmapBehavior';
=======
import { markersLayer } from './markersLayer';
import { geojsonMapper } from './geojsonMapper';
import { lastPointTracker } from './lastPointTracker';
>>>>>>> master

/**
 * Registry for layer handlers
 */
export const dataLayers = [
<<<<<<< HEAD
    worldmapBehaviorLayer, // mimic the existing worldmap
=======
    markersLayer,
>>>>>>> master
    lastPointTracker,
    geojsonMapper, // dummy for now
];
