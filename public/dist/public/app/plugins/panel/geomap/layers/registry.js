import { __read, __spreadArray } from "tslib";
import { Registry } from '@grafana/data';
import { carto } from './basemaps/carto';
import { config } from 'app/core/config';
import { basemapLayers } from './basemaps';
import { dataLayers } from './data';
export var DEFAULT_BASEMAP_CONFIG = {
    type: 'default',
    config: {},
};
// Default base layer depending on the server setting
export var defaultBaseLayer = {
    id: DEFAULT_BASEMAP_CONFIG.type,
    name: 'Default base layer',
    isBaseMap: true,
    create: function (map, options, theme) {
        var _a;
        var serverLayerType = (_a = config === null || config === void 0 ? void 0 : config.geomapDefaultBaseLayerConfig) === null || _a === void 0 ? void 0 : _a.type;
        if (serverLayerType) {
            var layer = geomapLayerRegistry.getIfExists(serverLayerType);
            if (!layer) {
                throw new Error('Invalid basemap configuraiton on server');
            }
            return layer.create(map, config.geomapDefaultBaseLayerConfig, theme);
        }
        // For now use carto as our default basemap
        return carto.create(map, options, theme);
    },
};
/**
 * Registry for layer handlers
 */
export var geomapLayerRegistry = new Registry(function () { return __spreadArray(__spreadArray([
    defaultBaseLayer
], __read(basemapLayers), false), __read(dataLayers), false); });
//# sourceMappingURL=registry.js.map