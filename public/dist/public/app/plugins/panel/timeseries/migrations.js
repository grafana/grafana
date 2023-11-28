import { omitBy, pickBy, isNil, isNumber, isString } from 'lodash';
import { FieldColorModeId, FieldConfigProperty, FieldMatcherID, fieldReducers, FieldType, NullValueMode, ReducerID, ThresholdsMode, } from '@grafana/data';
import { LegendDisplayMode, TooltipDisplayMode, AxisPlacement, GraphDrawStyle, GraphGradientMode, GraphTresholdsStyleMode, LineInterpolation, VisibilityMode, ScaleDistribution, StackingMode, SortOrder, GraphTransform, ComparisonOperation, } from '@grafana/schema';
import { getDashboardSrv } from 'app/features/dashboard/services/DashboardSrv';
import { getTimeSrv } from 'app/features/dashboard/services/TimeSrv';
import { GrafanaQueryType } from 'app/plugins/datasource/grafana/types';
import { defaultGraphConfig } from './config';
let dashboardRefreshDebouncer = null;
/**
 * This is called when the panel changes from another panel
 */
export const graphPanelChangedHandler = (panel, prevPluginId, prevOptions, prevFieldConfig) => {
    // Changing from angular/flot panel to react/uPlot
    if (prevPluginId === 'graph' && prevOptions.angular) {
        const { fieldConfig, options, annotations } = graphToTimeseriesOptions(Object.assign(Object.assign({}, prevOptions.angular), { fieldConfig: prevFieldConfig, panel: panel }));
        const dashboard = getDashboardSrv().getCurrent();
        if (dashboard && (annotations === null || annotations === void 0 ? void 0 : annotations.length) > 0) {
            dashboard.annotations.list = [...dashboard.annotations.list, ...annotations];
            // Trigger a full dashboard refresh when annotations change
            if (dashboardRefreshDebouncer == null) {
                dashboardRefreshDebouncer = setTimeout(() => {
                    dashboardRefreshDebouncer = null;
                    getTimeSrv().refreshTimeModel();
                });
            }
        }
        panel.fieldConfig = fieldConfig; // Mutates the incoming panel
        panel.alert = prevOptions.angular.alert;
        return options;
    }
    //fixes graph -> viz renaming in custom.hideFrom field config by mutation.
    migrateHideFrom(panel);
    return {};
};
export function graphToTimeseriesOptions(angular) {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k;
    let annotations = [];
    const overrides = (_b = (_a = angular.fieldConfig) === null || _a === void 0 ? void 0 : _a.overrides) !== null && _b !== void 0 ? _b : [];
    const yaxes = (_c = angular.yaxes) !== null && _c !== void 0 ? _c : [];
    let y1 = getFieldConfigFromOldAxis(yaxes[0]);
    if ((_d = angular.fieldConfig) === null || _d === void 0 ? void 0 : _d.defaults) {
        y1 = Object.assign(Object.assign({}, (_e = angular.fieldConfig) === null || _e === void 0 ? void 0 : _e.defaults), y1);
    }
    // Dashes
    const dash = {
        fill: angular.dashes ? 'dash' : 'solid',
        dash: [(_f = angular.dashLength) !== null && _f !== void 0 ? _f : 10, (_g = angular.spaceLength) !== null && _g !== void 0 ? _g : 10],
    };
    // "seriesOverrides": [
    //   {
    //     "$$hashKey": "object:183",
    //     "alias": "B-series",
    //     "fill": 3,
    //     "nullPointMode": "null as zero",
    //     "lines": true,
    //     "linewidth": 2
    //   }
    // ],
    if (angular.aliasColors) {
        for (const alias of Object.keys(angular.aliasColors)) {
            const color = angular.aliasColors[alias];
            if (color) {
                overrides.push({
                    matcher: {
                        id: FieldMatcherID.byName,
                        options: alias,
                    },
                    properties: [
                        {
                            id: FieldConfigProperty.Color,
                            value: {
                                mode: FieldColorModeId.Fixed,
                                fixedColor: color,
                            },
                        },
                    ],
                });
            }
        }
    }
    let hasFillBelowTo = false;
    if ((_h = angular.seriesOverrides) === null || _h === void 0 ? void 0 : _h.length) {
        for (const seriesOverride of angular.seriesOverrides) {
            if (!seriesOverride.alias) {
                continue; // the matcher config
            }
            const aliasIsRegex = /^([/~@;%#'])(.*?)\1([gimsuy]*)$/.test(seriesOverride.alias);
            const rule = {
                matcher: {
                    id: aliasIsRegex ? FieldMatcherID.byRegexp : FieldMatcherID.byName,
                    options: seriesOverride.alias,
                },
                properties: [],
            };
            let dashOverride = undefined;
            for (const p of Object.keys(seriesOverride)) {
                const v = seriesOverride[p];
                switch (p) {
                    // Ignore
                    case 'alias':
                    case '$$hashKey':
                        break;
                    // Link to y axis settings
                    case 'yaxis':
                        if (2 === v) {
                            const y2 = getFieldConfigFromOldAxis(yaxes[1]);
                            fillY2DynamicValues(y1, y2, rule.properties);
                        }
                        break;
                    case 'fill':
                        rule.properties.push({
                            id: 'custom.fillOpacity',
                            value: v * 10, // was 0-10, new graph is 0 - 100
                        });
                        break;
                    case 'fillBelowTo':
                        hasFillBelowTo = true;
                        rule.properties.push({
                            id: 'custom.fillBelowTo',
                            value: v,
                        });
                        break;
                    case 'fillGradient':
                        if (v) {
                            rule.properties.push({
                                id: 'custom.fillGradient',
                                value: 'opacity', // was 0-10
                            });
                            rule.properties.push({
                                id: 'custom.fillOpacity',
                                value: v * 10, // was 0-10, new graph is 0 - 100
                            });
                        }
                        break;
                    case 'points':
                        rule.properties.push({
                            id: 'custom.showPoints',
                            value: v ? VisibilityMode.Always : VisibilityMode.Never,
                        });
                        break;
                    case 'bars':
                        if (v) {
                            rule.properties.push({
                                id: 'custom.drawStyle',
                                value: GraphDrawStyle.Bars,
                            });
                            rule.properties.push({
                                id: 'custom.fillOpacity',
                                value: 100, // solid bars
                            });
                        }
                        else {
                            rule.properties.push({
                                id: 'custom.drawStyle',
                                value: GraphDrawStyle.Line, // Change from bars
                            });
                        }
                        break;
                    case 'lines':
                        if (v) {
                            rule.properties.push({
                                id: 'custom.drawStyle',
                                value: 'line',
                            });
                        }
                        else {
                            rule.properties.push({
                                id: 'custom.lineWidth',
                                value: 0,
                            });
                        }
                        break;
                    case 'linewidth':
                        rule.properties.push({
                            id: 'custom.lineWidth',
                            value: v,
                        });
                        break;
                    case 'pointradius':
                        rule.properties.push({
                            id: 'custom.pointSize',
                            value: 2 + v * 2,
                        });
                        break;
                    case 'dashLength':
                    case 'spaceLength':
                    case 'dashes':
                        if (!dashOverride) {
                            dashOverride = {
                                fill: dash.fill,
                                dash: [...dash.dash],
                            };
                        }
                        switch (p) {
                            case 'dashLength':
                                dashOverride.dash[0] = v;
                                break;
                            case 'spaceLength':
                                dashOverride.dash[1] = v;
                                break;
                            case 'dashes':
                                dashOverride.fill = v ? 'dash' : 'solid';
                                break;
                        }
                        break;
                    case 'stack':
                        rule.properties.push({
                            id: 'custom.stacking',
                            value: getStackingFromOverrides(v),
                        });
                        break;
                    case 'color':
                        rule.properties.push({
                            id: 'color',
                            value: {
                                fixedColor: v,
                                mode: FieldColorModeId.Fixed,
                            },
                        });
                        break;
                    case 'transform':
                        rule.properties.push({
                            id: 'custom.transform',
                            value: v === 'negative-Y' ? GraphTransform.NegativeY : GraphTransform.Constant,
                        });
                        break;
                    default:
                        console.log('Ignore override migration:', seriesOverride.alias, p, v);
                }
            }
            if (dashOverride) {
                rule.properties.push({
                    id: 'custom.lineStyle',
                    value: dashOverride,
                });
            }
            if (rule.properties.length) {
                overrides.push(rule);
            }
        }
    }
    const graph = (_j = y1.custom) !== null && _j !== void 0 ? _j : {};
    graph.drawStyle = angular.bars ? GraphDrawStyle.Bars : angular.lines ? GraphDrawStyle.Line : GraphDrawStyle.Points;
    if (angular.points) {
        graph.showPoints = VisibilityMode.Always;
        if (isNumber(angular.pointradius)) {
            graph.pointSize = 2 + angular.pointradius * 2;
        }
    }
    else if (graph.drawStyle !== GraphDrawStyle.Points) {
        graph.showPoints = VisibilityMode.Never;
    }
    graph.lineWidth = angular.linewidth;
    if (dash.fill !== 'solid') {
        graph.lineStyle = dash;
    }
    if (hasFillBelowTo) {
        graph.fillOpacity = 35; // bands are hardcoded in flot
    }
    else if (isNumber(angular.fill)) {
        graph.fillOpacity = angular.fill * 10; // fill was 0 - 10, new is 0 to 100
    }
    if (isNumber(angular.fillGradient) && angular.fillGradient > 0) {
        graph.gradientMode = GraphGradientMode.Opacity;
        graph.fillOpacity = angular.fillGradient * 10; // fill is 0-10
    }
    graph.spanNulls = angular.nullPointMode === NullValueMode.Ignore;
    if (angular.steppedLine) {
        graph.lineInterpolation = LineInterpolation.StepAfter;
    }
    if (graph.drawStyle === GraphDrawStyle.Bars) {
        graph.fillOpacity = 100; // bars were always
    }
    if (angular.stack) {
        graph.stacking = {
            mode: StackingMode.Normal,
            group: defaultGraphConfig.stacking.group,
        };
    }
    y1.custom = omitBy(graph, isNil);
    y1.nullValueMode = angular.nullPointMode;
    const options = {
        legend: {
            displayMode: LegendDisplayMode.List,
            showLegend: true,
            placement: 'bottom',
            calcs: [],
        },
        tooltip: {
            mode: TooltipDisplayMode.Single,
            sort: SortOrder.None,
        },
    };
    // Legend config migration
    const legendConfig = angular.legend;
    if (legendConfig) {
        if (legendConfig.show) {
            options.legend.displayMode = legendConfig.alignAsTable ? LegendDisplayMode.Table : LegendDisplayMode.List;
        }
        else {
            options.legend.showLegend = false;
        }
        if (legendConfig.rightSide) {
            options.legend.placement = 'right';
        }
        if (angular.legend.values) {
            const enabledLegendValues = pickBy(angular.legend);
            options.legend.calcs = getReducersFromLegend(enabledLegendValues);
        }
        if (angular.legend.sideWidth) {
            options.legend.width = angular.legend.sideWidth;
        }
        if (legendConfig.hideZero) {
            overrides.push(getLegendHideFromOverride(ReducerID.allIsZero));
        }
        if (legendConfig.hideEmpty) {
            overrides.push(getLegendHideFromOverride(ReducerID.allIsNull));
        }
    }
    // timeRegions migration
    if ((_k = angular.timeRegions) === null || _k === void 0 ? void 0 : _k.length) {
        let regions = angular.timeRegions.map((old, idx) => ({
            name: `T${idx + 1}`,
            color: old.colorMode !== 'custom' ? old.colorMode : old.fillColor,
            line: old.line,
            fill: old.fill,
            fromDayOfWeek: old.fromDayOfWeek,
            toDayOfWeek: old.toDayOfWeek,
            from: old.from,
            to: old.to,
        }));
        regions.forEach((region, idx) => {
            var _a, _b;
            const anno = {
                datasource: {
                    type: 'datasource',
                    uid: 'grafana',
                },
                enable: true,
                hide: true,
                filter: {
                    exclude: false,
                    ids: [angular.panel.id],
                },
                iconColor: (_a = region.fillColor) !== null && _a !== void 0 ? _a : region.color,
                name: `T${idx + 1}`,
                target: {
                    queryType: GrafanaQueryType.TimeRegions,
                    refId: 'Anno',
                    timeRegion: {
                        fromDayOfWeek: region.fromDayOfWeek,
                        toDayOfWeek: region.toDayOfWeek,
                        from: region.from,
                        to: region.to,
                        timezone: 'utc', // graph panel was always UTC
                    },
                },
            };
            if (region.fill) {
                annotations.push(anno);
            }
            else if (region.line) {
                anno.iconColor = (_b = region.lineColor) !== null && _b !== void 0 ? _b : 'white';
                annotations.push(anno);
            }
        });
    }
    const tooltipConfig = angular.tooltip;
    if (tooltipConfig) {
        if (tooltipConfig.shared !== undefined) {
            options.tooltip.mode = tooltipConfig.shared ? TooltipDisplayMode.Multi : TooltipDisplayMode.Single;
        }
        if (tooltipConfig.sort !== undefined && tooltipConfig.shared) {
            switch (tooltipConfig.sort) {
                case 1:
                    options.tooltip.sort = SortOrder.Ascending;
                    break;
                case 2:
                    options.tooltip.sort = SortOrder.Descending;
                    break;
                default:
                    options.tooltip.sort = SortOrder.None;
            }
        }
    }
    if (angular.thresholds && angular.thresholds.length > 0) {
        let steps = [];
        let area = false;
        let line = false;
        const sorted = angular.thresholds.sort((a, b) => (a.value > b.value ? 1 : -1));
        for (let idx = 0; idx < sorted.length; idx++) {
            const threshold = sorted[idx];
            const next = sorted.length > idx + 1 ? sorted[idx + 1] : null;
            if (threshold.fill) {
                area = true;
            }
            if (threshold.line) {
                line = true;
            }
            if (threshold.op === 'gt') {
                steps.push({
                    value: threshold.value,
                    color: getThresholdColor(threshold),
                });
            }
            if (threshold.op === 'lt') {
                if (steps.length === 0) {
                    steps.push({
                        value: -Infinity,
                        color: getThresholdColor(threshold),
                    });
                }
                // next op is gt and there is a gap set color to transparent
                if (next && next.op === 'gt' && next.value > threshold.value) {
                    steps.push({
                        value: threshold.value,
                        color: 'transparent',
                    });
                    // if next is a lt we need to use its color
                }
                else if (next && next.op === 'lt') {
                    steps.push({
                        value: threshold.value,
                        color: getThresholdColor(next),
                    });
                }
                else {
                    steps.push({
                        value: threshold.value,
                        color: 'transparent',
                    });
                }
            }
        }
        // if now less then threshold add an -Infinity base that is transparent
        if (steps.length > 0 && steps[0].value !== -Infinity) {
            steps.unshift({
                color: 'transparent',
                value: -Infinity,
            });
        }
        let displayMode = area ? GraphTresholdsStyleMode.Area : GraphTresholdsStyleMode.Line;
        if (line && area) {
            displayMode = GraphTresholdsStyleMode.LineAndArea;
        }
        // TODO move into standard ThresholdConfig ?
        y1.custom.thresholdsStyle = { mode: displayMode };
        y1.thresholds = {
            mode: ThresholdsMode.Absolute,
            steps,
        };
    }
    if (angular.xaxis && angular.xaxis.show === false && angular.xaxis.mode === 'time') {
        overrides.push({
            matcher: {
                id: FieldMatcherID.byType,
                options: FieldType.time,
            },
            properties: [
                {
                    id: 'custom.axisPlacement',
                    value: AxisPlacement.Hidden,
                },
            ],
        });
    }
    return {
        fieldConfig: {
            defaults: omitBy(y1, isNil),
            overrides,
        },
        options,
        annotations,
    };
}
function getThresholdColor(threshold) {
    if (threshold.colorMode === 'critical') {
        return 'red';
    }
    if (threshold.colorMode === 'warning') {
        return 'orange';
    }
    if (threshold.colorMode === 'custom') {
        return threshold.fillColor || threshold.lineColor;
    }
    return 'red';
}
// {
//   "label": "Y111",
//   "show": true,
//   "logBase": 10,
//   "min": "0",
//   "max": "1000",
//   "format": "areaMI2",
//   "$$hashKey": "object:19",
//   "decimals": 3
// },
function getFieldConfigFromOldAxis(obj) {
    if (!obj) {
        return {};
    }
    const graph = {
        axisPlacement: obj.show ? AxisPlacement.Auto : AxisPlacement.Hidden,
    };
    if (obj.label) {
        graph.axisLabel = obj.label;
    }
    if (obj.logBase) {
        const log = obj.logBase;
        if (log === 2 || log === 10) {
            graph.scaleDistribution = {
                type: ScaleDistribution.Log,
                log,
            };
        }
    }
    return omitBy({
        unit: obj.format,
        decimals: validNumber(obj.decimals),
        min: validNumber(obj.min),
        max: validNumber(obj.max),
        custom: graph,
    }, isNil);
}
function fillY2DynamicValues(y1, y2, props) {
    var _a, _b;
    // The standard properties
    for (const [key, value] of Object.entries(y2)) {
        if (key !== 'custom' && value !== y1[key]) {
            props.push({
                id: key,
                value,
            });
        }
    }
    // Add any custom property
    const y1G = (_a = y1.custom) !== null && _a !== void 0 ? _a : {};
    const y2G = (_b = y2.custom) !== null && _b !== void 0 ? _b : {};
    for (const [key, value] of Object.entries(y2G)) {
        if (value !== y1G[key]) {
            props.push({
                id: `custom.${key}`,
                value,
            });
        }
    }
}
function validNumber(val) {
    if (isNumber(val)) {
        return val;
    }
    if (isString(val)) {
        const num = Number(val);
        if (!isNaN(num)) {
            return num;
        }
    }
    return undefined;
}
function getReducersFromLegend(obj) {
    const ids = [];
    for (const key of Object.keys(obj)) {
        const r = fieldReducers.getIfExists(key);
        if (r) {
            ids.push(r.id);
        }
    }
    return ids;
}
function migrateHideFrom(panel) {
    var _a, _b, _c, _d, _e;
    if (((_d = (_c = (_b = (_a = panel.fieldConfig) === null || _a === void 0 ? void 0 : _a.defaults) === null || _b === void 0 ? void 0 : _b.custom) === null || _c === void 0 ? void 0 : _c.hideFrom) === null || _d === void 0 ? void 0 : _d.graph) !== undefined) {
        panel.fieldConfig.defaults.custom.hideFrom.viz = panel.fieldConfig.defaults.custom.hideFrom.graph;
        delete panel.fieldConfig.defaults.custom.hideFrom.graph;
    }
    if ((_e = panel.fieldConfig) === null || _e === void 0 ? void 0 : _e.overrides) {
        panel.fieldConfig.overrides = panel.fieldConfig.overrides.map((fr) => {
            fr.properties = fr.properties.map((p) => {
                if (p.id === 'custom.hideFrom' && p.value.graph) {
                    p.value.viz = p.value.graph;
                    delete p.value.graph;
                }
                return p;
            });
            return fr;
        });
    }
}
function getLegendHideFromOverride(reducer) {
    return {
        matcher: {
            id: FieldMatcherID.byValue,
            options: {
                reducer: reducer,
                op: ComparisonOperation.GTE,
                value: 0,
            },
        },
        properties: [
            {
                id: 'custom.hideFrom',
                value: {
                    tooltip: true,
                    viz: false,
                    legend: true,
                },
            },
        ],
    };
}
function getStackingFromOverrides(value) {
    var _a;
    const defaultGroupName = (_a = defaultGraphConfig.stacking) === null || _a === void 0 ? void 0 : _a.group;
    return {
        mode: value ? StackingMode.Normal : StackingMode.None,
        group: isString(value) ? value : defaultGroupName,
    };
}
//# sourceMappingURL=migrations.js.map