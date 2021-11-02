import { __assign, __read, __spreadArray, __values } from "tslib";
import uPlot from 'uplot';
import { merge } from 'lodash';
import { DefaultTimeZone, getTimeZoneInfo, } from '@grafana/data';
import { UPlotScaleBuilder } from './UPlotScaleBuilder';
import { UPlotSeriesBuilder } from './UPlotSeriesBuilder';
import { UPlotAxisBuilder } from './UPlotAxisBuilder';
import { AxisPlacement } from '@grafana/schema';
import { pluginLog } from '../utils';
import { getThresholdsDrawHook } from './UPlotThresholds';
var cursorDefaults = {
    // prevent client-side zoom from triggering at the end of a selection
    drag: { setScale: false },
    points: {
        /*@ts-ignore*/
        size: function (u, seriesIdx) { return u.series[seriesIdx].points.size * 2; },
        /*@ts-ignore*/
        width: function (u, seriesIdx, size) { return size / 4; },
    },
    focus: {
        prox: 30,
    },
};
var UPlotConfigBuilder = /** @class */ (function () {
    function UPlotConfigBuilder(timeZone) {
        var _this = this;
        if (timeZone === void 0) { timeZone = DefaultTimeZone; }
        var _a;
        this.series = [];
        this.axes = {};
        this.scales = [];
        this.bands = [];
        this.isStacking = false;
        this.hasLeftAxis = false;
        this.hooks = {};
        this.tz = undefined;
        this.sync = false;
        this.mode = 1;
        this.frames = undefined;
        // to prevent more than one threshold per scale
        this.thresholds = {};
        // Custom handler for closest datapoint and series lookup
        this.tooltipInterpolator = undefined;
        this.padding = undefined;
        this.prepData = undefined;
        // Exposed to let the container know the primary scale keys
        this.scaleKeys = ['', ''];
        this.tzDate = function (ts) {
            var date = new Date(ts);
            return _this.tz ? uPlot.tzDate(date, _this.tz) : date;
        };
        this.tz = (_a = getTimeZoneInfo(timeZone, Date.now())) === null || _a === void 0 ? void 0 : _a.ianaName;
    }
    UPlotConfigBuilder.prototype.addHook = function (type, hook) {
        pluginLog('UPlotConfigBuilder', false, 'addHook', type);
        if (!this.hooks[type]) {
            this.hooks[type] = [];
        }
        this.hooks[type].push(hook);
    };
    UPlotConfigBuilder.prototype.addThresholds = function (options) {
        if (!this.thresholds[options.scaleKey]) {
            this.thresholds[options.scaleKey] = options;
            this.addHook('drawClear', getThresholdsDrawHook(options));
        }
    };
    UPlotConfigBuilder.prototype.addAxis = function (props) {
        var _a, _b;
        props.placement = (_a = props.placement) !== null && _a !== void 0 ? _a : AxisPlacement.Auto;
        props.grid = (_b = props.grid) !== null && _b !== void 0 ? _b : {};
        if (this.axes[props.scaleKey]) {
            this.axes[props.scaleKey].merge(props);
            return;
        }
        // Handle auto placement logic
        if (props.placement === AxisPlacement.Auto) {
            props.placement = this.hasLeftAxis ? AxisPlacement.Right : AxisPlacement.Left;
        }
        if (props.placement === AxisPlacement.Left) {
            this.hasLeftAxis = true;
        }
        if (props.placement === AxisPlacement.Hidden) {
            props.grid.show = false;
            props.size = 0;
        }
        this.axes[props.scaleKey] = new UPlotAxisBuilder(props);
    };
    UPlotConfigBuilder.prototype.getAxisPlacement = function (scaleKey) {
        var _a;
        var axis = this.axes[scaleKey];
        return (_a = axis === null || axis === void 0 ? void 0 : axis.props.placement) !== null && _a !== void 0 ? _a : AxisPlacement.Left;
    };
    UPlotConfigBuilder.prototype.setCursor = function (cursor) {
        this.cursor = merge({}, this.cursor, cursor);
    };
    UPlotConfigBuilder.prototype.setMode = function (mode) {
        this.mode = mode;
    };
    UPlotConfigBuilder.prototype.setSelect = function (select) {
        this.select = select;
    };
    UPlotConfigBuilder.prototype.setStacking = function (enabled) {
        if (enabled === void 0) { enabled = true; }
        this.isStacking = enabled;
    };
    UPlotConfigBuilder.prototype.addSeries = function (props) {
        this.series.push(new UPlotSeriesBuilder(props));
    };
    UPlotConfigBuilder.prototype.getSeries = function () {
        return this.series;
    };
    /** Add or update the scale with the scale key */
    UPlotConfigBuilder.prototype.addScale = function (props) {
        var current = this.scales.find(function (v) { return v.props.scaleKey === props.scaleKey; });
        if (current) {
            current.merge(props);
            return;
        }
        this.scales.push(new UPlotScaleBuilder(props));
    };
    UPlotConfigBuilder.prototype.addBand = function (band) {
        this.bands.push(band);
    };
    UPlotConfigBuilder.prototype.setTooltipInterpolator = function (interpolator) {
        this.tooltipInterpolator = interpolator;
    };
    UPlotConfigBuilder.prototype.getTooltipInterpolator = function () {
        return this.tooltipInterpolator;
    };
    UPlotConfigBuilder.prototype.setPrepData = function (prepData) {
        var _this = this;
        this.prepData = function (frames) {
            _this.frames = frames;
            return prepData(frames);
        };
    };
    UPlotConfigBuilder.prototype.setSync = function () {
        this.sync = true;
    };
    UPlotConfigBuilder.prototype.hasSync = function () {
        return this.sync;
    };
    UPlotConfigBuilder.prototype.setPadding = function (padding) {
        this.padding = padding;
    };
    UPlotConfigBuilder.prototype.getConfig = function () {
        var e_1, _a;
        var _this = this;
        var _b;
        var config = {
            mode: this.mode,
            series: [
                this.mode === 2
                    ? null
                    : {
                        value: function () { return ''; },
                    },
            ],
        };
        config.axes = this.ensureNonOverlappingAxes(Object.values(this.axes)).map(function (a) { return a.getConfig(); });
        config.series = __spreadArray(__spreadArray([], __read(config.series), false), __read(this.series.map(function (s) { return s.getConfig(); })), false);
        config.scales = this.scales.reduce(function (acc, s) {
            return __assign(__assign({}, acc), s.getConfig());
        }, {});
        config.hooks = this.hooks;
        config.select = this.select;
        var pointColorFn = function (alphaHex) {
            if (alphaHex === void 0) { alphaHex = ''; }
            return function (u, seriesIdx) {
                /*@ts-ignore*/
                var s = u.series[seriesIdx].points._stroke;
                // interpolate for gradients/thresholds
                if (typeof s !== 'string') {
                    var field = _this.frames[0].fields[seriesIdx];
                    s = field.display(field.values.get(u.cursor.idxs[seriesIdx])).color;
                }
                return s + alphaHex;
            };
        };
        config.cursor = merge({}, cursorDefaults, {
            points: {
                stroke: pointColorFn('80'),
                fill: pointColorFn(),
            },
        }, this.cursor);
        config.tzDate = this.tzDate;
        config.padding = this.padding;
        if (this.isStacking) {
            // Let uPlot handle bands and fills
            config.bands = this.bands;
        }
        else {
            // When fillBelowTo option enabled, handle series bands fill manually
            if ((_b = this.bands) === null || _b === void 0 ? void 0 : _b.length) {
                config.bands = this.bands;
                var keepFill = new Set();
                try {
                    for (var _c = __values(config.bands), _d = _c.next(); !_d.done; _d = _c.next()) {
                        var b = _d.value;
                        keepFill.add(b.series[0]);
                    }
                }
                catch (e_1_1) { e_1 = { error: e_1_1 }; }
                finally {
                    try {
                        if (_d && !_d.done && (_a = _c.return)) _a.call(_c);
                    }
                    finally { if (e_1) throw e_1.error; }
                }
                for (var i = 1; i < config.series.length; i++) {
                    if (!keepFill.has(i)) {
                        config.series[i].fill = undefined;
                    }
                }
            }
        }
        return config;
    };
    UPlotConfigBuilder.prototype.ensureNonOverlappingAxes = function (axes) {
        var xAxis = axes.find(function (a) { return a.props.scaleKey === 'x'; });
        var axesWithoutGridSet = axes.filter(function (a) { var _a; return ((_a = a.props.grid) === null || _a === void 0 ? void 0 : _a.show) === undefined; });
        var firstValueAxisIdx = axesWithoutGridSet.findIndex(function (a) { return a.props.placement === AxisPlacement.Left || (a.props.placement === AxisPlacement.Bottom && a !== xAxis); });
        // For all axes with no grid set, set the grid automatically (grid only for first left axis )
        for (var i = 0; i < axesWithoutGridSet.length; i++) {
            if (axesWithoutGridSet[i] === xAxis || i === firstValueAxisIdx) {
                axesWithoutGridSet[i].props.grid.show = true;
            }
            else {
                axesWithoutGridSet[i].props.grid.show = false;
            }
        }
        return axes;
    };
    return UPlotConfigBuilder;
}());
export { UPlotConfigBuilder };
//# sourceMappingURL=UPlotConfigBuilder.js.map