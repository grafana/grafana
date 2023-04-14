import { markersLayer } from './markersLayer';
import { geojsonLayer } from './geojsonLayer';
import { heatmapLayer } from './heatMap';
import { lastPointTracker } from './lastPointTracker';
import { routeLayer } from './routeLayer';
import { dayNightLayer } from './dayNightLayer';
import { dynamicGeoJSONLayer } from './geojsonDynamic';
import { photosLayer } from './photosLayer';

/**
 * Registry for layer handlers
 */
export const dataLayers = [
    markersLayer, 
    heatmapLayer, 
    lastPointTracker, 
    geojsonLayer, 
    dynamicGeoJSONLayer, 
    dayNightLayer, 
    routeLayer,
    photosLayer
];
