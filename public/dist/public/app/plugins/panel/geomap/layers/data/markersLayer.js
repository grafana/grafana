import { __assign, __awaiter, __generator, __read, __spreadArray, __values } from "tslib";
import React from 'react';
import { FrameGeometrySourceMode, } from '@grafana/data';
import * as layer from 'ol/layer';
import * as source from 'ol/source';
import * as style from 'ol/style';
import { dataFrameToPoints, getLocationMatchers } from '../../utils/location';
import { getScaledDimension, getColorDimension, ResourceDimensionMode, ResourceFolderName, getPublicOrAbsoluteUrl, } from 'app/features/dimensions';
import { ScaleDimensionEditor, ColorDimensionEditor, ResourceDimensionEditor } from 'app/features/dimensions/editors';
import { ObservablePropsWrapper } from '../../components/ObservablePropsWrapper';
import { MarkersLegend } from './MarkersLegend';
import { getMarkerFromPath } from '../../utils/regularShapes';
import { ReplaySubject } from 'rxjs';
import { getFeatures } from '../../utils/getFeatures';
var DEFAULT_SIZE = 5;
var defaultOptions = {
    size: {
        fixed: DEFAULT_SIZE,
        min: 2,
        max: 15,
    },
    color: {
        fixed: 'dark-green', // picked from theme
    },
    fillOpacity: 0.4,
    showLegend: true,
    markerSymbol: {
        mode: ResourceDimensionMode.Fixed,
        fixed: 'img/icons/marker/circle.svg',
    },
};
export var MARKERS_LAYER_ID = 'markers';
// Used by default when nothing is configured
export var defaultMarkersConfig = {
    type: MARKERS_LAYER_ID,
    config: defaultOptions,
    location: {
        mode: FrameGeometrySourceMode.Auto,
    },
};
/**
 * Map layer configuration for circle overlay
 */
export var markersLayer = {
    id: MARKERS_LAYER_ID,
    name: 'Markers',
    description: 'use markers to render each data point',
    isBaseMap: false,
    showLocation: true,
    /**
     * Function that configures transformation and returns a transformer
     * @param options
     */
    create: function (map, options, theme) { return __awaiter(void 0, void 0, void 0, function () {
        var matchers, vectorLayer, config, legendProps, legend;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, getLocationMatchers(options.location)];
                case 1:
                    matchers = _a.sent();
                    vectorLayer = new layer.Vector({});
                    config = __assign(__assign({}, defaultOptions), options === null || options === void 0 ? void 0 : options.config);
                    legendProps = new ReplaySubject(1);
                    legend = null;
                    if (config.showLegend) {
                        legend = React.createElement(ObservablePropsWrapper, { watch: legendProps, initialSubProps: {}, child: MarkersLegend });
                    }
                    return [2 /*return*/, {
                            init: function () { return vectorLayer; },
                            legend: legend,
                            update: function (data) {
                                var e_1, _a;
                                var _b, _c, _d, _e, _f, _g, _h;
                                if (!((_b = data.series) === null || _b === void 0 ? void 0 : _b.length)) {
                                    return; // ignore empty
                                }
                                var markerPath = (_d = getPublicOrAbsoluteUrl((_c = config.markerSymbol) === null || _c === void 0 ? void 0 : _c.fixed)) !== null && _d !== void 0 ? _d : getPublicOrAbsoluteUrl('img/icons/marker/circle.svg');
                                var marker = getMarkerFromPath((_e = config.markerSymbol) === null || _e === void 0 ? void 0 : _e.fixed);
                                var makeIconStyle = function (cfg) {
                                    return new style.Style({
                                        image: new style.Icon({
                                            src: markerPath,
                                            color: cfg.color,
                                            //  opacity,
                                            scale: (DEFAULT_SIZE + cfg.size) / 100,
                                        }),
                                    });
                                };
                                var shape = (_f = marker === null || marker === void 0 ? void 0 : marker.make) !== null && _f !== void 0 ? _f : makeIconStyle;
                                var features = [];
                                try {
                                    for (var _j = __values(data.series), _k = _j.next(); !_k.done; _k = _j.next()) {
                                        var frame = _k.value;
                                        var info = dataFrameToPoints(frame, matchers);
                                        if (info.warning) {
                                            console.log('Could not find locations', info.warning);
                                            continue; // ???
                                        }
                                        var colorDim = getColorDimension(frame, config.color, theme);
                                        var sizeDim = getScaledDimension(frame, config.size);
                                        var opacity = (_h = (_g = options.config) === null || _g === void 0 ? void 0 : _g.fillOpacity) !== null && _h !== void 0 ? _h : defaultOptions.fillOpacity;
                                        var featureDimensionConfig = {
                                            colorDim: colorDim,
                                            sizeDim: sizeDim,
                                            opacity: opacity,
                                            styleMaker: shape,
                                        };
                                        var frameFeatures = getFeatures(frame, info, featureDimensionConfig);
                                        if (frameFeatures) {
                                            features.push.apply(features, __spreadArray([], __read(frameFeatures), false));
                                        }
                                        // Post updates to the legend component
                                        if (legend) {
                                            legendProps.next({
                                                color: colorDim,
                                                size: sizeDim,
                                            });
                                        }
                                        break; // Only the first frame for now!
                                    }
                                }
                                catch (e_1_1) { e_1 = { error: e_1_1 }; }
                                finally {
                                    try {
                                        if (_k && !_k.done && (_a = _j.return)) _a.call(_j);
                                    }
                                    finally { if (e_1) throw e_1.error; }
                                }
                                // Source reads the data and provides a set of features to visualize
                                var vectorSource = new source.Vector({ features: features });
                                vectorLayer.setSource(vectorSource);
                            },
                            // Marker overlay options
                            registerOptionsUI: function (builder) {
                                builder
                                    .addCustomEditor({
                                    id: 'config.size',
                                    path: 'config.size',
                                    name: 'Marker Size',
                                    editor: ScaleDimensionEditor,
                                    settings: {
                                        min: 1,
                                        max: 100, // possible in the UI
                                    },
                                    defaultValue: {
                                        // Configured values
                                        fixed: DEFAULT_SIZE,
                                        min: 1,
                                        max: 20,
                                    },
                                })
                                    .addCustomEditor({
                                    id: 'config.markerSymbol',
                                    path: 'config.markerSymbol',
                                    name: 'Marker Symbol',
                                    editor: ResourceDimensionEditor,
                                    defaultValue: defaultOptions.markerSymbol,
                                    settings: {
                                        resourceType: 'icon',
                                        showSourceRadio: false,
                                        folderName: ResourceFolderName.Marker,
                                    },
                                })
                                    .addCustomEditor({
                                    id: 'config.color',
                                    path: 'config.color',
                                    name: 'Marker Color',
                                    editor: ColorDimensionEditor,
                                    settings: {},
                                    defaultValue: {
                                        // Configured values
                                        fixed: 'grey',
                                    },
                                })
                                    .addSliderInput({
                                    path: 'config.fillOpacity',
                                    name: 'Fill opacity',
                                    defaultValue: defaultOptions.fillOpacity,
                                    settings: {
                                        min: 0,
                                        max: 1,
                                        step: 0.1,
                                    },
                                })
                                    .addBooleanSwitch({
                                    path: 'config.showLegend',
                                    name: 'Show legend',
                                    description: 'Show legend',
                                    defaultValue: defaultOptions.showLegend,
                                });
                            },
                        }];
            }
        });
    }); },
    // fill in the default values
    defaultOptions: defaultOptions,
};
//# sourceMappingURL=markersLayer.js.map