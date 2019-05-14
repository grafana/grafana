import * as tslib_1 from "tslib";
import { getFlotTickDecimals } from 'app/core/utils/ticks';
import _ from 'lodash';
import { getValueFormat, stringToJsRegex } from '@grafana/ui';
function matchSeriesOverride(aliasOrRegex, seriesAlias) {
    if (!aliasOrRegex) {
        return false;
    }
    if (aliasOrRegex[0] === '/') {
        var regex = stringToJsRegex(aliasOrRegex);
        return seriesAlias.match(regex) != null;
    }
    return aliasOrRegex === seriesAlias;
}
function translateFillOption(fill) {
    return fill === 0 ? 0.001 : fill / 10;
}
/**
 * Calculate decimals for legend and update values for each series.
 * @param data series data
 * @param panel
 * @param height
 */
export function updateLegendValues(data, panel, height) {
    for (var i = 0; i < data.length; i++) {
        var series = data[i];
        var yaxes = panel.yaxes;
        var seriesYAxis = series.yaxis || 1;
        var axis = yaxes[seriesYAxis - 1];
        var formatter = getValueFormat(axis.format);
        // decimal override
        if (_.isNumber(panel.decimals)) {
            series.updateLegendValues(formatter, panel.decimals, null);
        }
        else if (_.isNumber(axis.decimals)) {
            series.updateLegendValues(formatter, axis.decimals + 1, null);
        }
        else {
            // auto decimals
            // legend and tooltip gets one more decimal precision
            // than graph legend ticks
            var _a = getDataMinMax(data), datamin = _a.datamin, datamax = _a.datamax;
            var _b = getFlotTickDecimals(datamin, datamax, axis, height), tickDecimals = _b.tickDecimals, scaledDecimals = _b.scaledDecimals;
            var tickDecimalsPlusOne = (tickDecimals || -1) + 1;
            series.updateLegendValues(formatter, tickDecimalsPlusOne, scaledDecimals + 2);
        }
    }
}
export function getDataMinMax(data) {
    var e_1, _a;
    var datamin = null;
    var datamax = null;
    try {
        for (var data_1 = tslib_1.__values(data), data_1_1 = data_1.next(); !data_1_1.done; data_1_1 = data_1.next()) {
            var series = data_1_1.value;
            if (datamax === null || datamax < series.stats.max) {
                datamax = series.stats.max;
            }
            if (datamin === null || datamin > series.stats.min) {
                datamin = series.stats.min;
            }
        }
    }
    catch (e_1_1) { e_1 = { error: e_1_1 }; }
    finally {
        try {
            if (data_1_1 && !data_1_1.done && (_a = data_1.return)) _a.call(data_1);
        }
        finally { if (e_1) throw e_1.error; }
    }
    return { datamin: datamin, datamax: datamax };
}
var TimeSeries = /** @class */ (function () {
    function TimeSeries(opts) {
        this.datapoints = opts.datapoints;
        this.label = opts.alias;
        this.id = opts.alias;
        this.alias = opts.alias;
        this.aliasEscaped = _.escape(opts.alias);
        this.color = opts.color;
        this.bars = { fillColor: opts.color };
        this.valueFormater = getValueFormat('none');
        this.stats = {};
        this.legend = true;
        this.unit = opts.unit;
        this.hasMsResolution = this.isMsResolutionNeeded();
    }
    TimeSeries.prototype.applySeriesOverrides = function (overrides) {
        this.lines = {};
        this.dashes = {
            dashLength: [],
        };
        this.points = {};
        this.yaxis = 1;
        this.zindex = 0;
        this.nullPointMode = null;
        delete this.stack;
        delete this.bars.show;
        for (var i = 0; i < overrides.length; i++) {
            var override = overrides[i];
            if (!matchSeriesOverride(override.alias, this.alias)) {
                continue;
            }
            if (override.lines !== void 0) {
                this.lines.show = override.lines;
            }
            if (override.dashes !== void 0) {
                this.dashes.show = override.dashes;
                this.lines.lineWidth = 0;
            }
            if (override.points !== void 0) {
                this.points.show = override.points;
            }
            if (override.bars !== void 0) {
                this.bars.show = override.bars;
            }
            if (override.fill !== void 0) {
                this.lines.fill = translateFillOption(override.fill);
            }
            if (override.stack !== void 0) {
                this.stack = override.stack;
            }
            if (override.linewidth !== void 0) {
                this.lines.lineWidth = this.dashes.show ? 0 : override.linewidth;
                this.dashes.lineWidth = override.linewidth;
            }
            if (override.dashLength !== void 0) {
                this.dashes.dashLength[0] = override.dashLength;
            }
            if (override.spaceLength !== void 0) {
                this.dashes.dashLength[1] = override.spaceLength;
            }
            if (override.nullPointMode !== void 0) {
                this.nullPointMode = override.nullPointMode;
            }
            if (override.pointradius !== void 0) {
                this.points.radius = override.pointradius;
            }
            if (override.steppedLine !== void 0) {
                this.lines.steps = override.steppedLine;
            }
            if (override.zindex !== void 0) {
                this.zindex = override.zindex;
            }
            if (override.fillBelowTo !== void 0) {
                this.fillBelowTo = override.fillBelowTo;
            }
            if (override.color !== void 0) {
                this.setColor(override.color);
            }
            if (override.transform !== void 0) {
                this.transform = override.transform;
            }
            if (override.legend !== void 0) {
                this.legend = override.legend;
            }
            if (override.hideTooltip !== void 0) {
                this.hideTooltip = override.hideTooltip;
            }
            if (override.yaxis !== void 0) {
                this.yaxis = override.yaxis;
            }
        }
    };
    TimeSeries.prototype.getFlotPairs = function (fillStyle) {
        var result = [];
        this.stats.total = 0;
        this.stats.max = -Number.MAX_VALUE;
        this.stats.min = Number.MAX_VALUE;
        this.stats.logmin = Number.MAX_VALUE;
        this.stats.avg = null;
        this.stats.current = null;
        this.stats.first = null;
        this.stats.delta = 0;
        this.stats.diff = null;
        this.stats.range = null;
        this.stats.timeStep = Number.MAX_VALUE;
        this.allIsNull = true;
        this.allIsZero = true;
        var ignoreNulls = fillStyle === 'connected';
        var nullAsZero = fillStyle === 'null as zero';
        var currentTime;
        var currentValue;
        var nonNulls = 0;
        var previousTime;
        var previousValue = 0;
        var previousDeltaUp = true;
        for (var i = 0; i < this.datapoints.length; i++) {
            currentValue = this.datapoints[i][0];
            currentTime = this.datapoints[i][1];
            // Due to missing values we could have different timeStep all along the series
            // so we have to find the minimum one (could occur with aggregators such as ZimSum)
            if (previousTime !== undefined) {
                var timeStep = currentTime - previousTime;
                if (timeStep < this.stats.timeStep) {
                    this.stats.timeStep = timeStep;
                }
            }
            previousTime = currentTime;
            if (currentValue === null) {
                if (ignoreNulls) {
                    continue;
                }
                if (nullAsZero) {
                    currentValue = 0;
                }
            }
            if (currentValue !== null) {
                if (_.isNumber(currentValue)) {
                    this.stats.total += currentValue;
                    this.allIsNull = false;
                    nonNulls++;
                }
                if (currentValue > this.stats.max) {
                    this.stats.max = currentValue;
                }
                if (currentValue < this.stats.min) {
                    this.stats.min = currentValue;
                }
                if (this.stats.first === null) {
                    this.stats.first = currentValue;
                }
                else {
                    if (previousValue > currentValue) {
                        // counter reset
                        previousDeltaUp = false;
                        if (i === this.datapoints.length - 1) {
                            // reset on last
                            this.stats.delta += currentValue;
                        }
                    }
                    else {
                        if (previousDeltaUp) {
                            this.stats.delta += currentValue - previousValue; // normal increment
                        }
                        else {
                            this.stats.delta += currentValue; // account for counter reset
                        }
                        previousDeltaUp = true;
                    }
                }
                previousValue = currentValue;
                if (currentValue < this.stats.logmin && currentValue > 0) {
                    this.stats.logmin = currentValue;
                }
                if (currentValue !== 0) {
                    this.allIsZero = false;
                }
            }
            result.push([currentTime, currentValue]);
        }
        if (this.stats.max === -Number.MAX_VALUE) {
            this.stats.max = null;
        }
        if (this.stats.min === Number.MAX_VALUE) {
            this.stats.min = null;
        }
        if (result.length && !this.allIsNull) {
            this.stats.avg = this.stats.total / nonNulls;
            this.stats.current = result[result.length - 1][1];
            if (this.stats.current === null && result.length > 1) {
                this.stats.current = result[result.length - 2][1];
            }
        }
        if (this.stats.max !== null && this.stats.min !== null) {
            this.stats.range = this.stats.max - this.stats.min;
        }
        if (this.stats.current !== null && this.stats.first !== null) {
            this.stats.diff = this.stats.current - this.stats.first;
        }
        this.stats.count = result.length;
        return result;
    };
    TimeSeries.prototype.updateLegendValues = function (formater, decimals, scaledDecimals) {
        this.valueFormater = formater;
        this.decimals = decimals;
        this.scaledDecimals = scaledDecimals;
    };
    TimeSeries.prototype.formatValue = function (value) {
        if (!_.isFinite(value)) {
            value = null; // Prevent NaN formatting
        }
        return this.valueFormater(value, this.decimals, this.scaledDecimals);
    };
    TimeSeries.prototype.isMsResolutionNeeded = function () {
        for (var i = 0; i < this.datapoints.length; i++) {
            if (this.datapoints[i][1] !== null) {
                var timestamp = this.datapoints[i][1].toString();
                if (timestamp.length === 13 && timestamp % 1000 !== 0) {
                    return true;
                }
            }
        }
        return false;
    };
    TimeSeries.prototype.hideFromLegend = function (options) {
        if (options.hideEmpty && this.allIsNull) {
            return true;
        }
        // ignore series excluded via override
        if (!this.legend) {
            return true;
        }
        // ignore zero series
        if (options.hideZero && this.allIsZero) {
            return true;
        }
        return false;
    };
    TimeSeries.prototype.setColor = function (color) {
        this.color = color;
        this.bars.fillColor = color;
    };
    return TimeSeries;
}());
export default TimeSeries;
//# sourceMappingURL=time_series2.js.map