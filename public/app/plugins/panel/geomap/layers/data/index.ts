import { dayNightLayer } from './dayNightLayer';
import { dynamicGeoJSONLayer } from './geojsonDynamic';
import { geojsonLayer } from './geojsonLayer';
import { geometryLayer } from './geometryLayer';
import { heatmapLayer } from './heatMap';
import { lastPointTracker } from './lastPointTracker';
import { markersLayer } from './markersLayer';
import { networkLayer } from './networkLayer';
import { photosLayer } from './photosLayer';
import { routeLayer } from './routeLayer';

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
  geometryLayer,
  photosLayer,
  networkLayer,
];
