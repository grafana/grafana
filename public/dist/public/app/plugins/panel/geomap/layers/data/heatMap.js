import { __assign, __awaiter, __generator } from "tslib";
import { FieldType, getFieldColorModeForField, } from '@grafana/data';
import Feature from 'ol/Feature';
import * as layer from 'ol/layer';
import * as source from 'ol/source';
import { dataFrameToPoints, getLocationMatchers } from '../../utils/location';
import { getScaledDimension } from 'app/features/dimensions';
import { ScaleDimensionEditor } from 'app/features/dimensions/editors';
var defaultOptions = {
    weight: {
        fixed: 1,
        min: 0,
        max: 1,
    },
    blur: 15,
    radius: 5,
};
/**
 * Map layer configuration for heatmap overlay
 */
export var heatmapLayer = {
    id: 'heatmap',
    name: 'Heatmap',
    description: 'visualizes a heatmap of the data',
    isBaseMap: false,
    showLocation: true,
    /**
     * Function that configures transformation and returns a transformer
     * @param options
     */
    create: function (map, options, theme) { return __awaiter(void 0, void 0, void 0, function () {
        var config, matchers, vectorSource, vectorLayer;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    config = __assign(__assign({}, defaultOptions), options.config);
                    return [4 /*yield*/, getLocationMatchers(options.location)];
                case 1:
                    matchers = _a.sent();
                    vectorSource = new source.Vector();
                    vectorLayer = new layer.Heatmap({
                        source: vectorSource,
                        blur: config.blur,
                        radius: config.radius,
                        weight: function (feature) {
                            var weight = feature.get('value');
                            return weight;
                        },
                    });
                    return [2 /*return*/, {
                            init: function () { return vectorLayer; },
                            update: function (data) {
                                var _a;
                                var frame = data.series[0];
                                // Remove previous data before updating
                                var features = vectorLayer.getSource().getFeatures();
                                features.forEach(function (feature) {
                                    vectorLayer.getSource().removeFeature(feature);
                                });
                                if (!frame) {
                                    return;
                                }
                                // Get data points (latitude and longitude coordinates)
                                var info = dataFrameToPoints(frame, matchers);
                                if (info.warning) {
                                    console.log('WARN', info.warning);
                                    return; // ???
                                }
                                var weightDim = getScaledDimension(frame, config.weight);
                                // Map each data value into new points
                                for (var i = 0; i < frame.length; i++) {
                                    var cluster = new Feature({
                                        geometry: info.points[i],
                                        value: weightDim.get(i),
                                    });
                                    vectorSource.addFeature(cluster);
                                }
                                vectorLayer.setSource(vectorSource);
                                // Set heatmap gradient colors
                                var colors = ['#00f', '#0ff', '#0f0', '#ff0', '#f00'];
                                // Either the configured field or the first numeric field value
                                var field = (_a = weightDim.field) !== null && _a !== void 0 ? _a : frame.fields.find(function (field) { return field.type === FieldType.number; });
                                if (field) {
                                    var colorMode = getFieldColorModeForField(field);
                                    if (colorMode.isContinuous && colorMode.getColors) {
                                        // getColors return an array of color string from the color scheme chosen
                                        colors = colorMode.getColors(theme);
                                    }
                                }
                                vectorLayer.setGradient(colors);
                            },
                            // Heatmap overlay options
                            registerOptionsUI: function (builder) {
                                builder
                                    .addCustomEditor({
                                    id: 'config.weight',
                                    path: 'config.weight',
                                    name: 'Weight values',
                                    description: 'Scale the distribution for each row',
                                    editor: ScaleDimensionEditor,
                                    settings: {
                                        min: 0,
                                        max: 1,
                                        hideRange: true, // Don't show the scale factor
                                    },
                                    defaultValue: {
                                        // Configured values
                                        fixed: 1,
                                        min: 0,
                                        max: 1,
                                    },
                                })
                                    .addSliderInput({
                                    path: 'config.radius',
                                    description: 'configures the size of clusters',
                                    name: 'Radius',
                                    defaultValue: defaultOptions.radius,
                                    settings: {
                                        min: 1,
                                        max: 50,
                                        step: 1,
                                    },
                                })
                                    .addSliderInput({
                                    path: 'config.blur',
                                    description: 'configures the amount of blur of clusters',
                                    name: 'Blur',
                                    defaultValue: defaultOptions.blur,
                                    settings: {
                                        min: 1,
                                        max: 50,
                                        step: 1,
                                    },
                                });
                            },
                        }];
            }
        });
    }); },
    // fill in the default values
    defaultOptions: defaultOptions,
};
//# sourceMappingURL=heatMap.js.map