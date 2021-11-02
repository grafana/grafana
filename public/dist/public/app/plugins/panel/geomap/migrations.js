import { __assign, __read, __spreadArray, __values } from "tslib";
import { ThresholdsMode } from '@grafana/data';
import { markerMakers } from './utils/regularShapes';
import { MapCenterID } from './view';
/**
 * This is called when the panel changes from another panel
 */
export var mapPanelChangedHandler = function (panel, prevPluginId, prevOptions, prevFieldConfig) {
    // Changing from angular/worldmap panel to react/openlayers
    if (prevPluginId === 'grafana-worldmap-panel' && prevOptions.angular) {
        var _a = worldmapToGeomapOptions(__assign(__assign({}, prevOptions.angular), { fieldConfig: prevFieldConfig })), fieldConfig = _a.fieldConfig, options = _a.options;
        panel.fieldConfig = fieldConfig; // Mutates the incoming panel
        return options;
    }
    return {};
};
export function worldmapToGeomapOptions(angular) {
    var e_1, _a;
    var fieldConfig = {
        defaults: {},
        overrides: [],
    };
    var options = {
        view: {
            id: MapCenterID.Zero,
        },
        controls: {
            showZoom: true,
            mouseWheelZoom: Boolean(angular.mouseWheelZoom),
        },
        basemap: {
            type: 'default', // was carto
        },
        layers: [
        // TODO? depends on current configs
        ],
    };
    var v = asNumber(angular.decimals);
    if (v) {
        fieldConfig.defaults.decimals = v;
    }
    // Convert thresholds and color values
    if (angular.thresholds && angular.colors) {
        var levels = angular.thresholds.split(',').map(function (strVale) {
            return Number(strVale.trim());
        });
        // One more color than threshold
        var thresholds = [];
        try {
            for (var _b = __values(angular.colors), _c = _b.next(); !_c.done; _c = _b.next()) {
                var color = _c.value;
                var idx = thresholds.length - 1;
                if (idx >= 0) {
                    thresholds.push({ value: levels[idx], color: color });
                }
                else {
                    thresholds.push({ value: -Infinity, color: color });
                }
            }
        }
        catch (e_1_1) { e_1 = { error: e_1_1 }; }
        finally {
            try {
                if (_c && !_c.done && (_a = _b.return)) _a.call(_b);
            }
            finally { if (e_1) throw e_1.error; }
        }
        fieldConfig.defaults.thresholds = {
            mode: ThresholdsMode.Absolute,
            steps: thresholds,
        };
    }
    v = asNumber(angular.initialZoom);
    if (v) {
        options.view.zoom = v;
    }
    // mapCenter: 'Europe',
    // mapCenterLatitude: 46,
    // mapCenterLongitude: 14,
    //
    // Map center (from worldmap)
    var mapCenters = {
        '(0°, 0°)': MapCenterID.Zero,
        'North America': 'north-america',
        Europe: 'europe',
        'West Asia': 'west-asia',
        'SE Asia': 'se-asia',
        'Last GeoHash': MapCenterID.Coordinates, // MapCenterID.LastPoint,
    };
    options.view.id = mapCenters[angular.mapCenter];
    options.view.lat = asNumber(angular.mapCenterLatitude);
    options.view.lon = asNumber(angular.mapCenterLongitude);
    return { fieldConfig: fieldConfig, options: options };
}
function asNumber(v) {
    var num = +v;
    return isNaN(num) ? undefined : num;
}
export var mapMigrationHandler = function (panel) {
    var _a, _b, _c, _d;
    var pluginVersion = panel === null || panel === void 0 ? void 0 : panel.pluginVersion;
    if ((pluginVersion === null || pluginVersion === void 0 ? void 0 : pluginVersion.startsWith('8.1')) || (pluginVersion === null || pluginVersion === void 0 ? void 0 : pluginVersion.startsWith('8.2')) || (pluginVersion === null || pluginVersion === void 0 ? void 0 : pluginVersion.startsWith('8.3'))) {
        if (((_b = (_a = panel.options) === null || _a === void 0 ? void 0 : _a.layers) === null || _b === void 0 ? void 0 : _b.length) > 0) {
            var layer = panel.options.layers[0];
            if ((layer === null || layer === void 0 ? void 0 : layer.type) === 'markers') {
                var shape = (_c = layer === null || layer === void 0 ? void 0 : layer.config) === null || _c === void 0 ? void 0 : _c.shape;
                if (shape) {
                    var marker = markerMakers.getIfExists(shape);
                    if ((marker === null || marker === void 0 ? void 0 : marker.aliasIds) && ((_d = marker.aliasIds) === null || _d === void 0 ? void 0 : _d.length) > 0) {
                        layer.config.markerSymbol = {
                            fixed: marker.aliasIds[0],
                            mode: 'fixed',
                        };
                        delete layer.config.shape;
                    }
                    return __assign(__assign({}, panel.options), { layers: Object.assign.apply(Object, __spreadArray(__spreadArray([[]], __read(panel.options.layers), false), [{ 0: layer }], false)) });
                }
            }
        }
    }
    return panel.options;
};
//# sourceMappingURL=migrations.js.map