import { __assign, __read, __spreadArray, __values } from "tslib";
import { FieldColorModeId, FieldConfigProperty, FieldMatcherID, fieldReducers, NullValueMode, ThresholdsMode, } from '@grafana/data';
import { LegendDisplayMode, TooltipDisplayMode, AxisPlacement, GraphDrawStyle, GraphGradientMode, GraphTresholdsStyleMode, LineInterpolation, VisibilityMode, ScaleDistribution, StackingMode, } from '@grafana/schema';
import { omitBy, pickBy, isNil, isNumber, isString } from 'lodash';
import { defaultGraphConfig } from './config';
/**
 * This is called when the panel changes from another panel
 */
export var graphPanelChangedHandler = function (panel, prevPluginId, prevOptions, prevFieldConfig) {
    // Changing from angular/flot panel to react/uPlot
    if (prevPluginId === 'graph' && prevOptions.angular) {
        var _a = flotToGraphOptions(__assign(__assign({}, prevOptions.angular), { fieldConfig: prevFieldConfig })), fieldConfig = _a.fieldConfig, options = _a.options;
        panel.fieldConfig = fieldConfig; // Mutates the incoming panel
        panel.alert = prevOptions.angular.alert;
        return options;
    }
    //fixes graph -> viz renaming in custom.hideFrom field config by mutation.
    migrateHideFrom(panel);
    return {};
};
export function flotToGraphOptions(angular) {
    var e_1, _a, e_2, _b, e_3, _c;
    var _d, _e, _f, _g, _h, _j, _k, _l, _m;
    var overrides = (_e = (_d = angular.fieldConfig) === null || _d === void 0 ? void 0 : _d.overrides) !== null && _e !== void 0 ? _e : [];
    var yaxes = (_f = angular.yaxes) !== null && _f !== void 0 ? _f : [];
    var y1 = getFieldConfigFromOldAxis(yaxes[0]);
    if ((_g = angular.fieldConfig) === null || _g === void 0 ? void 0 : _g.defaults) {
        y1 = __assign(__assign({}, (_h = angular.fieldConfig) === null || _h === void 0 ? void 0 : _h.defaults), y1);
    }
    // Dashes
    var dash = {
        fill: angular.dashes ? 'dash' : 'solid',
        dash: [(_j = angular.dashLength) !== null && _j !== void 0 ? _j : 10, (_k = angular.spaceLength) !== null && _k !== void 0 ? _k : 10],
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
        try {
            for (var _o = __values(Object.keys(angular.aliasColors)), _p = _o.next(); !_p.done; _p = _o.next()) {
                var alias = _p.value;
                var color = angular.aliasColors[alias];
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
        catch (e_1_1) { e_1 = { error: e_1_1 }; }
        finally {
            try {
                if (_p && !_p.done && (_a = _o.return)) _a.call(_o);
            }
            finally { if (e_1) throw e_1.error; }
        }
    }
    var hasFillBelowTo = false;
    if ((_l = angular.seriesOverrides) === null || _l === void 0 ? void 0 : _l.length) {
        try {
            for (var _q = __values(angular.seriesOverrides), _r = _q.next(); !_r.done; _r = _q.next()) {
                var seriesOverride = _r.value;
                if (!seriesOverride.alias) {
                    continue; // the matcher config
                }
                var aliasIsRegex = seriesOverride.alias.startsWith('/') && seriesOverride.alias.endsWith('/');
                var rule = {
                    matcher: {
                        id: aliasIsRegex ? FieldMatcherID.byRegexp : FieldMatcherID.byName,
                        options: seriesOverride.alias,
                    },
                    properties: [],
                };
                var dashOverride = undefined;
                try {
                    for (var _s = (e_3 = void 0, __values(Object.keys(seriesOverride))), _t = _s.next(); !_t.done; _t = _s.next()) {
                        var p = _t.value;
                        var v = seriesOverride[p];
                        switch (p) {
                            // Ignore
                            case 'alias':
                            case '$$hashKey':
                                break;
                            // Link to y axis settings
                            case 'yaxis':
                                if (2 === v) {
                                    var y2 = getFieldConfigFromOldAxis(yaxes[1]);
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
                                rule.properties.push({
                                    id: 'custom.lineWidth',
                                    value: 0, // don't show lines
                                });
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
                                        dash: __spreadArray([], __read(dash.dash), false),
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
                                    value: { mode: StackingMode.Normal, group: v },
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
                            default:
                                console.log('Ignore override migration:', seriesOverride.alias, p, v);
                        }
                    }
                }
                catch (e_3_1) { e_3 = { error: e_3_1 }; }
                finally {
                    try {
                        if (_t && !_t.done && (_c = _s.return)) _c.call(_s);
                    }
                    finally { if (e_3) throw e_3.error; }
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
        catch (e_2_1) { e_2 = { error: e_2_1 }; }
        finally {
            try {
                if (_r && !_r.done && (_b = _q.return)) _b.call(_q);
            }
            finally { if (e_2) throw e_2.error; }
        }
    }
    var graph = (_m = y1.custom) !== null && _m !== void 0 ? _m : {};
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
    graph.spanNulls = angular.nullPointMode === NullValueMode.Null;
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
    var options = {
        legend: {
            displayMode: LegendDisplayMode.List,
            placement: 'bottom',
            calcs: [],
        },
        tooltip: {
            mode: TooltipDisplayMode.Single,
        },
    };
    // Legend config migration
    var legendConfig = angular.legend;
    if (legendConfig) {
        if (legendConfig.show) {
            options.legend.displayMode = legendConfig.alignAsTable ? LegendDisplayMode.Table : LegendDisplayMode.List;
        }
        else {
            options.legend.displayMode = LegendDisplayMode.Hidden;
        }
        if (legendConfig.rightSide) {
            options.legend.placement = 'right';
        }
        if (angular.legend.values) {
            var enabledLegendValues = pickBy(angular.legend);
            options.legend.calcs = getReducersFromLegend(enabledLegendValues);
        }
    }
    if (angular.thresholds && angular.thresholds.length > 0) {
        var steps = [];
        var area = false;
        var line = false;
        var sorted = angular.thresholds.sort(function (a, b) { return (a.value > b.value ? 1 : -1); });
        for (var idx = 0; idx < sorted.length; idx++) {
            var threshold = sorted[idx];
            var next = sorted.length > idx + 1 ? sorted[idx + 1] : null;
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
                    // if next is a lt we need to use it's color
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
        var displayMode = area ? GraphTresholdsStyleMode.Area : GraphTresholdsStyleMode.Line;
        if (line && area) {
            displayMode = GraphTresholdsStyleMode.LineAndArea;
        }
        // TODO move into standard ThresholdConfig ?
        y1.custom.thresholdsStyle = { mode: displayMode };
        y1.thresholds = {
            mode: ThresholdsMode.Absolute,
            steps: steps,
        };
    }
    return {
        fieldConfig: {
            defaults: omitBy(y1, isNil),
            overrides: overrides,
        },
        options: options,
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
    var graph = {
        axisPlacement: obj.show ? AxisPlacement.Auto : AxisPlacement.Hidden,
    };
    if (obj.label) {
        graph.axisLabel = obj.label;
    }
    if (obj.logBase) {
        var log = obj.logBase;
        if (log === 2 || log === 10) {
            graph.scaleDistribution = {
                type: ScaleDistribution.Log,
                log: log,
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
    var e_4, _a, e_5, _b;
    var _c, _d;
    try {
        // The standard properties
        for (var _e = __values(Object.keys(y2)), _f = _e.next(); !_f.done; _f = _e.next()) {
            var key = _f.value;
            var value = y2[key];
            if (key !== 'custom' && value !== y1[key]) {
                props.push({
                    id: key,
                    value: value,
                });
            }
        }
    }
    catch (e_4_1) { e_4 = { error: e_4_1 }; }
    finally {
        try {
            if (_f && !_f.done && (_a = _e.return)) _a.call(_e);
        }
        finally { if (e_4) throw e_4.error; }
    }
    // Add any custom property
    var y1G = (_c = y1.custom) !== null && _c !== void 0 ? _c : {};
    var y2G = (_d = y2.custom) !== null && _d !== void 0 ? _d : {};
    try {
        for (var _g = __values(Object.keys(y2G)), _h = _g.next(); !_h.done; _h = _g.next()) {
            var key = _h.value;
            var value = y2G[key];
            if (value !== y1G[key]) {
                props.push({
                    id: "custom." + key,
                    value: value,
                });
            }
        }
    }
    catch (e_5_1) { e_5 = { error: e_5_1 }; }
    finally {
        try {
            if (_h && !_h.done && (_b = _g.return)) _b.call(_g);
        }
        finally { if (e_5) throw e_5.error; }
    }
}
function validNumber(val) {
    if (isNumber(val)) {
        return val;
    }
    if (isString(val)) {
        var num = Number(val);
        if (!isNaN(num)) {
            return num;
        }
    }
    return undefined;
}
function getReducersFromLegend(obj) {
    var e_6, _a;
    var ids = [];
    try {
        for (var _b = __values(Object.keys(obj)), _c = _b.next(); !_c.done; _c = _b.next()) {
            var key = _c.value;
            var r = fieldReducers.getIfExists(key);
            if (r) {
                ids.push(r.id);
            }
        }
    }
    catch (e_6_1) { e_6 = { error: e_6_1 }; }
    finally {
        try {
            if (_c && !_c.done && (_a = _b.return)) _a.call(_b);
        }
        finally { if (e_6) throw e_6.error; }
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
        panel.fieldConfig.overrides = panel.fieldConfig.overrides.map(function (fr) {
            fr.properties = fr.properties.map(function (p) {
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
//# sourceMappingURL=migrations.js.map