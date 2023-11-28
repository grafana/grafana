import { cloneDeep } from 'lodash';
import { ThresholdsMode, fieldReducers, FrameGeometrySourceMode, DataTransformerID, } from '@grafana/data';
import { ResourceDimensionMode } from '@grafana/schema';
import { defaultMarkersConfig } from './layers/data/markersLayer';
import { getMarkerAsPath } from './style/markers';
import { defaultStyleConfig } from './style/types';
import { TooltipMode } from './types';
import { MapCenterID } from './view';
/**
 * This is called when the panel changes from another panel
 */
export const mapPanelChangedHandler = (panel, prevPluginId, prevOptions, prevFieldConfig) => {
    var _a;
    // Changing from angular/worldmap panel to react/openlayers
    if (prevPluginId === 'grafana-worldmap-panel' && prevOptions.angular) {
        const { fieldConfig, options, xform } = worldmapToGeomapOptions(Object.assign(Object.assign({}, prevOptions.angular), { fieldConfig: prevFieldConfig }));
        if ((_a = xform === null || xform === void 0 ? void 0 : xform.id) === null || _a === void 0 ? void 0 : _a.length) {
            panel.transformations = panel.transformations ? [...panel.transformations, xform] : [xform];
        }
        panel.fieldConfig = fieldConfig; // Mutates the incoming panel
        return options;
    }
    return {};
};
export function worldmapToGeomapOptions(angular) {
    var _a;
    const fieldConfig = {
        defaults: {},
        overrides: [],
    };
    const markersLayer = cloneDeep(defaultMarkersConfig);
    const options = {
        view: {
            id: MapCenterID.Zero,
        },
        controls: {
            showZoom: true,
            mouseWheelZoom: Boolean(angular.mouseWheelZoom),
        },
        basemap: {
            type: 'default',
            name: 'Basemap',
        },
        layers: [markersLayer],
        tooltip: { mode: TooltipMode.Details },
    };
    let v = asNumber(angular.decimals);
    if (v) {
        fieldConfig.defaults.decimals = v;
    }
    // Set the markers range
    const style = markersLayer.config.style;
    v = asNumber(angular.circleMaxSize);
    if (v) {
        style.size.max = v;
    }
    v = asNumber(angular.circleMinSize);
    if (v) {
        style.size.min = v;
    }
    let xform = undefined;
    const reducer = fieldReducers.getIfExists(angular.valueName);
    if (reducer && ((_a = angular.locationData) === null || _a === void 0 ? void 0 : _a.length)) {
        xform = {
            id: DataTransformerID.reduce,
            options: {
                reducers: [reducer.id],
            },
        };
        switch (angular.locationData) {
            case 'countries':
            case 'countries_3letter':
                markersLayer.location = {
                    mode: FrameGeometrySourceMode.Lookup,
                    gazetteer: 'public/gazetteer/countries.json',
                    lookup: undefined, // will default to first string field from reducer
                };
                break;
            case 'states':
                markersLayer.location = {
                    mode: FrameGeometrySourceMode.Lookup,
                    gazetteer: 'public/gazetteer/usa-states.json',
                    lookup: undefined, // will default to first string field from reducer
                };
                break;
        }
    }
    // Convert thresholds and color values
    if (angular.thresholds && angular.colors) {
        const levels = angular.thresholds.split(',').map((strVale) => {
            return Number(strVale.trim());
        });
        // One more color than threshold
        const thresholds = [];
        for (const color of angular.colors) {
            const idx = thresholds.length - 1;
            if (idx >= 0) {
                thresholds.push({ value: levels[idx], color });
            }
            else {
                thresholds.push({ value: -Infinity, color });
            }
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
    const mapCenters = {
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
    return { fieldConfig, options, xform };
}
function asNumber(v) {
    const num = Number(v);
    return isNaN(num) ? undefined : num;
}
export const mapMigrationHandler = (panel) => {
    var _a, _b;
    const pluginVersion = (_a = panel === null || panel === void 0 ? void 0 : panel.pluginVersion) !== null && _a !== void 0 ? _a : '';
    // before 8.3, only one layer was supported!
    if (pluginVersion.startsWith('8.1') || pluginVersion.startsWith('8.2')) {
        const layers = (_b = panel.options) === null || _b === void 0 ? void 0 : _b.layers;
        if ((layers === null || layers === void 0 ? void 0 : layers.length) === 1) {
            const layer = panel.options.layers[0];
            if ((layer === null || layer === void 0 ? void 0 : layer.type) === 'markers' && layer.config) {
                // Moving style to child object
                const oldConfig = layer.config;
                const config = {
                    style: cloneDeep(defaultStyleConfig),
                    showLegend: Boolean(oldConfig.showLegend),
                };
                if (oldConfig.size) {
                    config.style.size = oldConfig.size;
                }
                if (oldConfig.color) {
                    config.style.color = oldConfig.color;
                }
                if (oldConfig.fillOpacity) {
                    config.style.opacity = oldConfig.fillOpacity;
                }
                const symbol = getMarkerAsPath(oldConfig.shape);
                if (symbol) {
                    config.style.symbol = {
                        fixed: symbol,
                        mode: ResourceDimensionMode.Fixed,
                    };
                }
                return Object.assign(Object.assign({}, panel.options), { layers: [Object.assign(Object.assign({}, layer), { config })] });
            }
        }
    }
    return panel.options;
};
//# sourceMappingURL=migrations.js.map