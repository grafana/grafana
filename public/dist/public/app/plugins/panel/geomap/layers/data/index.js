import { markersLayer } from './markersLayer';
import { geojsonMapper } from './geojsonMapper';
import { heatmapLayer } from './heatMap';
import { lastPointTracker } from './lastPointTracker';
import { textLabelsLayer } from './textLabelsLayer';
/**
 * Registry for layer handlers
 */
export var dataLayers = [
    markersLayer,
    heatmapLayer,
    lastPointTracker,
    geojsonMapper,
    textLabelsLayer,
];
//# sourceMappingURL=index.js.map