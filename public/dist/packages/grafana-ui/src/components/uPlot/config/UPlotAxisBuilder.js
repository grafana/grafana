import { __extends } from "tslib";
import { dateTimeFormat, isBooleanUnit, systemDateFormats } from '@grafana/data';
import { PlotConfigBuilder } from '../types';
import { measureText } from '../../../utils/measureText';
import { AxisPlacement } from '@grafana/schema';
import { optMinMax } from './UPlotScaleBuilder';
var fontSize = 12;
var labelPad = 8;
var UPlotAxisBuilder = /** @class */ (function (_super) {
    __extends(UPlotAxisBuilder, _super);
    function UPlotAxisBuilder() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    UPlotAxisBuilder.prototype.merge = function (props) {
        this.props.size = optMinMax('max', this.props.size, props.size);
        if (!this.props.label) {
            this.props.label = props.label;
        }
        if (this.props.placement === AxisPlacement.Auto) {
            this.props.placement = props.placement;
        }
    };
    UPlotAxisBuilder.prototype.getConfig = function () {
        var _a;
        var _b = this.props, scaleKey = _b.scaleKey, label = _b.label, _c = _b.show, show = _c === void 0 ? true : _c, _d = _b.placement, placement = _d === void 0 ? AxisPlacement.Auto : _d, _e = _b.grid, grid = _e === void 0 ? { show: true } : _e, _f = _b.ticks, ticks = _f === void 0 ? true : _f, _g = _b.gap, gap = _g === void 0 ? 5 : _g, formatValue = _b.formatValue, splits = _b.splits, values = _b.values, isTime = _b.isTime, timeZone = _b.timeZone, theme = _b.theme;
        var font = fontSize + "px " + theme.typography.fontFamily;
        var gridColor = theme.isDark ? 'rgba(240, 250, 255, 0.09)' : 'rgba(0, 10, 23, 0.09)';
        if (isBooleanUnit(scaleKey)) {
            splits = [0, 1];
        }
        var config = {
            scale: scaleKey,
            show: show,
            stroke: theme.colors.text.primary,
            side: getUPlotSideFromAxis(placement),
            font: font,
            size: (_a = this.props.size) !== null && _a !== void 0 ? _a : calculateAxisSize,
            gap: gap,
            labelGap: 0,
            grid: {
                show: grid.show,
                stroke: gridColor,
                width: 1 / devicePixelRatio,
            },
            ticks: {
                show: ticks,
                stroke: gridColor,
                width: 1 / devicePixelRatio,
                size: 4,
            },
            splits: splits,
            values: values,
            space: calculateSpace,
        };
        if (label != null && label.length > 0) {
            config.label = label;
            config.labelSize = fontSize + labelPad;
            config.labelFont = font;
            config.labelGap = labelPad;
        }
        if (values) {
            config.values = values;
        }
        else if (isTime) {
            config.values = formatTime;
        }
        else if (formatValue) {
            config.values = function (u, vals) { return vals.map(formatValue); };
        }
        // store timezone
        config.timeZone = timeZone;
        return config;
    };
    return UPlotAxisBuilder;
}(PlotConfigBuilder));
export { UPlotAxisBuilder };
/* Minimum grid & tick spacing in CSS pixels */
function calculateSpace(self, axisIdx, scaleMin, scaleMax, plotDim) {
    var axis = self.axes[axisIdx];
    var scale = self.scales[axis.scale];
    // for axis left & right
    if (axis.side !== 2 || !scale) {
        return 30;
    }
    var defaultSpacing = 40;
    if (scale.time) {
        var maxTicks = plotDim / defaultSpacing;
        var increment = (scaleMax - scaleMin) / maxTicks;
        var sample = formatTime(self, [scaleMin], axisIdx, defaultSpacing, increment);
        var width = measureText(sample[0], fontSize).width + 18;
        return width;
    }
    return defaultSpacing;
}
/** height of x axis or width of y axis in CSS pixels alloted for values, gap & ticks, but excluding axis label */
function calculateAxisSize(self, values, axisIdx) {
    var axis = self.axes[axisIdx];
    var axisSize = axis.ticks.size;
    if (axis.side === 2) {
        axisSize += axis.gap + fontSize;
    }
    else if (values === null || values === void 0 ? void 0 : values.length) {
        var maxTextWidth = values.reduce(function (acc, value) { return Math.max(acc, measureText(value, fontSize).width); }, 0);
        axisSize += axis.gap + axis.labelGap + maxTextWidth;
    }
    return Math.ceil(axisSize);
}
var timeUnitSize = {
    second: 1000,
    minute: 60 * 1000,
    hour: 60 * 60 * 1000,
    day: 24 * 60 * 60 * 1000,
    month: 28 * 24 * 60 * 60 * 1000,
    year: 365 * 24 * 60 * 60 * 1000,
};
/** Format time axis ticks */
function formatTime(self, splits, axisIdx, foundSpace, foundIncr) {
    var _a, _b;
    var timeZone = self.axes[axisIdx].timeZone;
    var scale = self.scales.x;
    var range = ((_a = scale === null || scale === void 0 ? void 0 : scale.max) !== null && _a !== void 0 ? _a : 0) - ((_b = scale === null || scale === void 0 ? void 0 : scale.min) !== null && _b !== void 0 ? _b : 0);
    var yearRoundedToDay = Math.round(timeUnitSize.year / timeUnitSize.day) * timeUnitSize.day;
    var incrementRoundedToDay = Math.round(foundIncr / timeUnitSize.day) * timeUnitSize.day;
    var format = systemDateFormats.interval.year;
    if (foundIncr < timeUnitSize.second) {
        format = systemDateFormats.interval.second.replace('ss', 'ss.SS');
    }
    else if (foundIncr <= timeUnitSize.minute) {
        format = systemDateFormats.interval.second;
    }
    else if (range <= timeUnitSize.day) {
        format = systemDateFormats.interval.minute;
    }
    else if (foundIncr <= timeUnitSize.day) {
        format = systemDateFormats.interval.hour;
    }
    else if (range < timeUnitSize.year) {
        format = systemDateFormats.interval.day;
    }
    else if (incrementRoundedToDay === yearRoundedToDay) {
        format = systemDateFormats.interval.year;
    }
    else if (foundIncr <= timeUnitSize.year) {
        format = systemDateFormats.interval.month;
    }
    return splits.map(function (v) { return dateTimeFormat(v, { format: format, timeZone: timeZone }); });
}
export function getUPlotSideFromAxis(axis) {
    switch (axis) {
        case AxisPlacement.Top:
            return 0;
        case AxisPlacement.Right:
            return 1;
        case AxisPlacement.Bottom:
            return 2;
        case AxisPlacement.Left:
    }
    return 3; // default everythign to the left
}
//# sourceMappingURL=UPlotAxisBuilder.js.map