import { __read, __spreadArray } from "tslib";
import { cartoLayers } from './carto';
import { esriLayers } from './esri';
import { genericLayers } from './generic';
import { osmLayers } from './osm';
/**
 * Registry for layer handlers
 */
export var basemapLayers = __spreadArray(__spreadArray(__spreadArray(__spreadArray([], __read(osmLayers), false), __read(cartoLayers), false), __read(esriLayers), false), __read(genericLayers), false);
//# sourceMappingURL=index.js.map