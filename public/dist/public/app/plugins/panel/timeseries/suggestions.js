import { GraphDrawStyle, GraphGradientMode, LegendDisplayMode, LineInterpolation, StackingMode, } from '@grafana/schema';
import { SuggestionName } from 'app/types/suggestions';
var TimeSeriesSuggestionsSupplier = /** @class */ (function () {
    function TimeSeriesSuggestionsSupplier() {
    }
    TimeSeriesSuggestionsSupplier.prototype.getSuggestionsForData = function (builder) {
        var dataSummary = builder.dataSummary;
        if (!dataSummary.hasTimeField || !dataSummary.hasNumberField || dataSummary.rowCountTotal < 2) {
            return;
        }
        var list = builder.getListAppender({
            name: SuggestionName.LineChart,
            pluginId: 'timeseries',
            options: {
                legend: {},
            },
            fieldConfig: {
                defaults: {
                    custom: {},
                },
                overrides: [],
            },
            previewModifier: function (s) {
                var _a, _b;
                s.options.legend.displayMode = LegendDisplayMode.Hidden;
                if (((_b = (_a = s.fieldConfig) === null || _a === void 0 ? void 0 : _a.defaults.custom) === null || _b === void 0 ? void 0 : _b.drawStyle) !== GraphDrawStyle.Bars) {
                    s.fieldConfig.defaults.custom.lineWidth = 3;
                }
            },
        });
        var maxBarsCount = 100;
        list.append({
            name: SuggestionName.LineChart,
        });
        if (dataSummary.rowCountMax < 200) {
            list.append({
                name: SuggestionName.LineChartSmooth,
                fieldConfig: {
                    defaults: {
                        custom: {
                            lineInterpolation: LineInterpolation.Smooth,
                        },
                    },
                    overrides: [],
                },
            });
        }
        // Single series suggestions
        if (dataSummary.numberFieldCount === 1) {
            list.append({
                name: SuggestionName.AreaChart,
                fieldConfig: {
                    defaults: {
                        custom: {
                            fillOpacity: 25,
                        },
                    },
                    overrides: [],
                },
            });
            if (dataSummary.rowCountMax < maxBarsCount) {
                list.append({
                    name: SuggestionName.BarChart,
                    fieldConfig: {
                        defaults: {
                            custom: {
                                drawStyle: GraphDrawStyle.Bars,
                                fillOpacity: 100,
                                lineWidth: 1,
                                gradientMode: GraphGradientMode.Hue,
                            },
                        },
                        overrides: [],
                    },
                });
            }
            return;
        }
        // Multiple series suggestions
        list.append({
            name: SuggestionName.AreaChartStacked,
            fieldConfig: {
                defaults: {
                    custom: {
                        fillOpacity: 25,
                        stacking: {
                            mode: StackingMode.Normal,
                            group: 'A',
                        },
                    },
                },
                overrides: [],
            },
        });
        list.append({
            name: SuggestionName.AreaChartStackedPercent,
            fieldConfig: {
                defaults: {
                    custom: {
                        fillOpacity: 25,
                        stacking: {
                            mode: StackingMode.Percent,
                            group: 'A',
                        },
                    },
                },
                overrides: [],
            },
        });
        if (dataSummary.rowCountTotal / dataSummary.numberFieldCount < maxBarsCount) {
            list.append({
                name: SuggestionName.BarChartStacked,
                fieldConfig: {
                    defaults: {
                        custom: {
                            drawStyle: GraphDrawStyle.Bars,
                            fillOpacity: 100,
                            lineWidth: 1,
                            gradientMode: GraphGradientMode.Hue,
                            stacking: {
                                mode: StackingMode.Normal,
                                group: 'A',
                            },
                        },
                    },
                    overrides: [],
                },
            });
            list.append({
                name: SuggestionName.BarChartStackedPercent,
                fieldConfig: {
                    defaults: {
                        custom: {
                            drawStyle: GraphDrawStyle.Bars,
                            fillOpacity: 100,
                            lineWidth: 1,
                            gradientMode: GraphGradientMode.Hue,
                            stacking: {
                                mode: StackingMode.Percent,
                                group: 'A',
                            },
                        },
                    },
                    overrides: [],
                },
            });
        }
    };
    return TimeSeriesSuggestionsSupplier;
}());
export { TimeSeriesSuggestionsSupplier };
//# sourceMappingURL=suggestions.js.map