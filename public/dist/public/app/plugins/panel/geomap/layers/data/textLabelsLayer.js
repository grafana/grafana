import { __assign, __awaiter, __generator, __read, __spreadArray, __values } from "tslib";
import { PluginState } from '@grafana/data';
import * as layer from 'ol/layer';
import * as source from 'ol/source';
import * as style from 'ol/style';
import { dataFrameToPoints, getLocationMatchers } from '../../utils/location';
import { getColorDimension, getScaledDimension, getTextDimension, TextDimensionMode, } from 'app/features/dimensions';
import { ColorDimensionEditor, ScaleDimensionEditor, TextDimensionEditor } from 'app/features/dimensions/editors';
import { Fill, Stroke } from 'ol/style';
import { getFeatures } from '../../utils/getFeatures';
export var TEXT_LABELS_LAYER = 'text-labels';
var defaultOptions = {
    labelText: {
        fixed: '',
        mode: TextDimensionMode.Field,
    },
    color: {
        fixed: 'dark-blue',
    },
    fillOpacity: 0.6,
    fontSize: {
        fixed: 10,
        min: 5,
        max: 100,
    },
};
export var textLabelsLayer = {
    id: TEXT_LABELS_LAYER,
    name: 'Text labels',
    description: 'render text labels',
    isBaseMap: false,
    state: PluginState.alpha,
    showLocation: true,
    create: function (map, options, theme) { return __awaiter(void 0, void 0, void 0, function () {
        var matchers, vectorLayer, config, fontFamily, getTextStyle, getStyle;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, getLocationMatchers(options.location)];
                case 1:
                    matchers = _a.sent();
                    vectorLayer = new layer.Vector({});
                    config = __assign(__assign({}, defaultOptions), options === null || options === void 0 ? void 0 : options.config);
                    fontFamily = theme.typography.fontFamily;
                    getTextStyle = function (text, fillColor, fontSize) {
                        return new style.Text({
                            text: text,
                            fill: new Fill({ color: fillColor }),
                            stroke: new Stroke({ color: fillColor }),
                            font: "normal " + fontSize + "px " + fontFamily,
                        });
                    };
                    getStyle = function (cfg) {
                        var _a;
                        return new style.Style({
                            text: getTextStyle((_a = cfg.text) !== null && _a !== void 0 ? _a : defaultOptions.labelText.fixed, cfg.fillColor, cfg.size),
                        });
                    };
                    return [2 /*return*/, {
                            init: function () { return vectorLayer; },
                            update: function (data) {
                                var e_1, _a;
                                var _b, _c, _d;
                                if (!((_b = data.series) === null || _b === void 0 ? void 0 : _b.length)) {
                                    return;
                                }
                                var features = [];
                                try {
                                    for (var _e = __values(data.series), _f = _e.next(); !_f.done; _f = _e.next()) {
                                        var frame = _f.value;
                                        var info = dataFrameToPoints(frame, matchers);
                                        if (info.warning) {
                                            console.log('Could not find locations', info.warning);
                                            return;
                                        }
                                        var colorDim = getColorDimension(frame, config.color, theme);
                                        var textDim = getTextDimension(frame, config.labelText);
                                        var sizeDim = getScaledDimension(frame, config.fontSize);
                                        var opacity = (_d = (_c = options.config) === null || _c === void 0 ? void 0 : _c.fillOpacity) !== null && _d !== void 0 ? _d : defaultOptions.fillOpacity;
                                        var featureDimensionConfig = {
                                            colorDim: colorDim,
                                            sizeDim: sizeDim,
                                            textDim: textDim,
                                            opacity: opacity,
                                            styleMaker: getStyle,
                                        };
                                        var frameFeatures = getFeatures(frame, info, featureDimensionConfig);
                                        if (frameFeatures) {
                                            features.push.apply(features, __spreadArray([], __read(frameFeatures), false));
                                        }
                                    }
                                }
                                catch (e_1_1) { e_1 = { error: e_1_1 }; }
                                finally {
                                    try {
                                        if (_f && !_f.done && (_a = _e.return)) _a.call(_e);
                                    }
                                    finally { if (e_1) throw e_1.error; }
                                }
                                // Source reads the data and provides a set of features to visualize
                                var vectorSource = new source.Vector({ features: features });
                                vectorLayer.setSource(vectorSource);
                            },
                            registerOptionsUI: function (builder) {
                                builder
                                    .addCustomEditor({
                                    id: 'config.labelText',
                                    name: 'Text label',
                                    path: 'config.labelText',
                                    editor: TextDimensionEditor,
                                })
                                    .addCustomEditor({
                                    id: 'config.color',
                                    path: 'config.color',
                                    name: 'Text color',
                                    editor: ColorDimensionEditor,
                                    settings: {},
                                })
                                    .addSliderInput({
                                    path: 'config.fillOpacity',
                                    name: 'Text opacity',
                                    defaultValue: defaultOptions.fillOpacity,
                                    settings: {
                                        min: 0,
                                        max: 1,
                                        step: 0.1,
                                    },
                                })
                                    .addCustomEditor({
                                    id: 'config.fontSize',
                                    path: 'config.fontSize',
                                    name: 'Text size',
                                    editor: ScaleDimensionEditor,
                                    settings: {
                                        fixed: defaultOptions.fontSize.fixed,
                                        min: defaultOptions.fontSize.min,
                                        max: defaultOptions.fontSize.max,
                                    },
                                });
                            },
                        }];
            }
        });
    }); },
    defaultOptions: defaultOptions,
};
//# sourceMappingURL=textLabelsLayer.js.map