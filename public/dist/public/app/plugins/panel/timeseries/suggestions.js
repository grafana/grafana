import { FieldColorModeId, DataTransformerID, } from '@grafana/data';
import { GraphDrawStyle, GraphGradientMode, LegendDisplayMode, LineInterpolation, StackingMode, } from '@grafana/schema';
import { getDashboardSrv } from 'app/features/dashboard/services/DashboardSrv';
import { SuggestionName } from 'app/types/suggestions';
export class TimeSeriesSuggestionsSupplier {
    getSuggestionsForData(builder) {
        const { dataSummary } = builder;
        if (!dataSummary.hasTimeField || !dataSummary.hasNumberField || dataSummary.rowCountTotal < 2) {
            return;
        }
        const list = builder.getListAppender({
            name: SuggestionName.LineChart,
            pluginId: 'timeseries',
            options: {
                legend: {
                    calcs: [],
                    displayMode: LegendDisplayMode.Hidden,
                    placement: 'right',
                    showLegend: false,
                },
            },
            fieldConfig: {
                defaults: {
                    custom: {},
                },
                overrides: [],
            },
            cardOptions: {
                previewModifier: (s) => {
                    var _a, _b, _c;
                    if (((_b = (_a = s.fieldConfig) === null || _a === void 0 ? void 0 : _a.defaults.custom) === null || _b === void 0 ? void 0 : _b.drawStyle) !== GraphDrawStyle.Bars) {
                        s.fieldConfig.defaults.custom.lineWidth = Math.max((_c = s.fieldConfig.defaults.custom.lineWidth) !== null && _c !== void 0 ? _c : 1, 2);
                    }
                },
            },
        });
        const maxBarsCount = 100;
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
            list.append({
                name: SuggestionName.LineChartGradientColorScheme,
                fieldConfig: {
                    defaults: {
                        color: {
                            mode: FieldColorModeId.ContinuousGrYlRd,
                        },
                        custom: {
                            gradientMode: GraphGradientMode.Scheme,
                            lineInterpolation: LineInterpolation.Smooth,
                            lineWidth: 3,
                            fillOpacity: 20,
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
                list.append({
                    name: SuggestionName.BarChartGradientColorScheme,
                    fieldConfig: {
                        defaults: {
                            color: {
                                mode: FieldColorModeId.ContinuousGrYlRd,
                            },
                            custom: {
                                drawStyle: GraphDrawStyle.Bars,
                                fillOpacity: 90,
                                lineWidth: 1,
                                gradientMode: GraphGradientMode.Scheme,
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
    }
}
// This will try to get a suggestion that will add a long to wide conversion
export function getPrepareTimeseriesSuggestion(panelId) {
    var _a;
    const panel = (_a = getDashboardSrv().getCurrent()) === null || _a === void 0 ? void 0 : _a.getPanelById(panelId);
    if (panel) {
        const transformations = panel.transformations ? [...panel.transformations] : [];
        transformations.push({
            id: DataTransformerID.prepareTimeSeries,
            options: {
                format: 'wide',
            },
        });
        return {
            name: 'Transform to wide time series format',
            pluginId: 'timeseries',
            transformations,
        };
    }
    return undefined;
}
//# sourceMappingURL=suggestions.js.map