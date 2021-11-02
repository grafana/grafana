import { __assign, __extends, __values } from "tslib";
import React from 'react';
import uPlot from 'uplot';
import { LegendDisplayMode, ScaleDistribution, AxisPlacement, ScaleDirection, ScaleOrientation, } from '@grafana/schema';
import { formattedValueToString, getFieldColorModeForField, getFieldSeriesColor, } from '@grafana/data';
import { UPlotConfigBuilder, UPlotChart, VizLayout, PlotLegend } from '@grafana/ui';
import { histogramBucketSizes, histogramFrameBucketMaxFieldName, } from '@grafana/data/src/transformations/transformers/histogram';
function incrRoundDn(num, incr) {
    return Math.floor(num / incr) * incr;
}
function incrRoundUp(num, incr) {
    return Math.ceil(num / incr) * incr;
}
export function getBucketSize(frame) {
    // assumes BucketMin is fields[0] and BucktMax is fields[1]
    return frame.fields[1].values.get(0) - frame.fields[0].values.get(0);
}
var prepConfig = function (frame, theme) {
    // todo: scan all values in BucketMin and BucketMax fields to assert if uniform bucketSize
    var _a, _b;
    var builder = new UPlotConfigBuilder();
    // assumes BucketMin is fields[0] and BucktMax is fields[1]
    var bucketSize = getBucketSize(frame);
    // splits shifter, to ensure splits always start at first bucket
    var xSplits = function (u, axisIdx, scaleMin, scaleMax, foundIncr, foundSpace) {
        /** @ts-ignore */
        var minSpace = u.axes[axisIdx]._space;
        var bucketWidth = u.valToPos(u.data[0][0] + bucketSize, 'x') - u.valToPos(u.data[0][0], 'x');
        var firstSplit = u.data[0][0];
        var lastSplit = u.data[0][u.data[0].length - 1] + bucketSize;
        var splits = [];
        var skip = Math.ceil(minSpace / bucketWidth);
        for (var i = 0, s = firstSplit; s <= lastSplit; i++, s += bucketSize) {
            !(i % skip) && splits.push(s);
        }
        return splits;
    };
    builder.addScale({
        scaleKey: 'x',
        isTime: false,
        distribution: ScaleDistribution.Linear,
        orientation: ScaleOrientation.Horizontal,
        direction: ScaleDirection.Right,
        range: function (u, wantedMin, wantedMax) {
            var fullRangeMin = u.data[0][0];
            var fullRangeMax = u.data[0][u.data[0].length - 1];
            // snap to bucket divisors...
            if (wantedMax === fullRangeMax) {
                wantedMax += bucketSize;
            }
            else {
                wantedMax = incrRoundUp(wantedMax, bucketSize);
            }
            if (wantedMin > fullRangeMin) {
                wantedMin = incrRoundDn(wantedMin, bucketSize);
            }
            return [wantedMin, wantedMax];
        },
    });
    builder.addScale({
        scaleKey: 'y',
        isTime: false,
        distribution: ScaleDistribution.Linear,
        orientation: ScaleOrientation.Vertical,
        direction: ScaleDirection.Up,
    });
    var fmt = frame.fields[0].display;
    var xAxisFormatter = function (v) {
        return formattedValueToString(fmt(v));
    };
    builder.addAxis({
        scaleKey: 'x',
        isTime: false,
        placement: AxisPlacement.Bottom,
        incrs: histogramBucketSizes,
        splits: xSplits,
        values: function (u, vals) { return vals.map(xAxisFormatter); },
        //incrs: () => [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((mult) => mult * bucketSize),
        //splits: config.xSplits,
        //values: config.xValues,
        //grid: false,
        //ticks: false,
        //gap: 15,
        theme: theme,
    });
    builder.addAxis({
        scaleKey: 'y',
        isTime: false,
        placement: AxisPlacement.Left,
        //splits: config.xSplits,
        //values: config.xValues,
        //grid: false,
        //ticks: false,
        //gap: 15,
        theme: theme,
    });
    builder.setCursor({
        points: { show: false },
        drag: {
            x: true,
            y: false,
            setScale: true,
        },
    });
    var pathBuilder = uPlot.paths.bars({ align: 1, size: [1, Infinity] });
    var seriesIndex = 0;
    // assumes BucketMax is [1]
    for (var i = 2; i < frame.fields.length; i++) {
        var field = frame.fields[i];
        field.state = (_a = field.state) !== null && _a !== void 0 ? _a : {};
        field.state.seriesIndex = seriesIndex++;
        var customConfig = __assign({}, field.config.custom);
        var scaleKey = 'y';
        var colorMode = getFieldColorModeForField(field);
        var scaleColor = getFieldSeriesColor(field, theme);
        var seriesColor = scaleColor.color;
        builder.addSeries({
            scaleKey: scaleKey,
            lineWidth: customConfig.lineWidth,
            lineColor: seriesColor,
            //lineStyle: customConfig.lineStyle,
            fillOpacity: customConfig.fillOpacity,
            theme: theme,
            colorMode: colorMode,
            pathBuilder: pathBuilder,
            //pointsBuilder: config.drawPoints,
            show: !((_b = customConfig.hideFrom) === null || _b === void 0 ? void 0 : _b.vis),
            gradientMode: customConfig.gradientMode,
            thresholds: field.config.thresholds,
            hardMin: field.config.min,
            hardMax: field.config.max,
            softMin: customConfig.axisSoftMin,
            softMax: customConfig.axisSoftMax,
            // The following properties are not used in the uPlot config, but are utilized as transport for legend config
            dataFrameFieldIndex: {
                fieldIndex: i,
                frameIndex: 0,
            },
        });
    }
    return builder;
};
var preparePlotData = function (frame) {
    var e_1, _a;
    var data = [];
    try {
        for (var _b = __values(frame.fields), _c = _b.next(); !_c.done; _c = _b.next()) {
            var field = _c.value;
            if (field.name !== histogramFrameBucketMaxFieldName) {
                data.push(field.values.toArray());
            }
        }
    }
    catch (e_1_1) { e_1 = { error: e_1_1 }; }
    finally {
        try {
            if (_c && !_c.done && (_a = _b.return)) _a.call(_b);
        }
        finally { if (e_1) throw e_1.error; }
    }
    // uPlot's bars pathBuilder will draw rects even if 0 (to distinguish them from nulls)
    // but for histograms we want to omit them, so remap 0s -> nulls
    for (var i = 1; i < data.length; i++) {
        var counts = data[i];
        for (var j = 0; j < counts.length; j++) {
            if (counts[j] === 0) {
                counts[j] = null;
            }
        }
    }
    return data;
};
var Histogram = /** @class */ (function (_super) {
    __extends(Histogram, _super);
    function Histogram(props) {
        var _this = _super.call(this, props) || this;
        _this.state = _this.prepState(props);
        return _this;
    }
    Histogram.prototype.prepState = function (props, withConfig) {
        if (withConfig === void 0) { withConfig = true; }
        var state = null;
        var alignedFrame = props.alignedFrame;
        if (alignedFrame) {
            state = {
                alignedData: preparePlotData(alignedFrame),
            };
            if (withConfig) {
                state.config = prepConfig(alignedFrame, this.props.theme);
            }
        }
        return state;
    };
    Histogram.prototype.renderLegend = function (config) {
        var legend = this.props.legend;
        if (!config || legend.displayMode === LegendDisplayMode.Hidden) {
            return null;
        }
        return React.createElement(PlotLegend, __assign({ data: [this.props.alignedFrame], config: config, maxHeight: "35%", maxWidth: "60%" }, legend));
    };
    Histogram.prototype.componentDidUpdate = function (prevProps) {
        var _a = this.props, structureRev = _a.structureRev, alignedFrame = _a.alignedFrame, bucketSize = _a.bucketSize;
        if (alignedFrame !== prevProps.alignedFrame) {
            var newState = this.prepState(this.props, false);
            if (newState) {
                var shouldReconfig = bucketSize !== prevProps.bucketSize ||
                    this.props.options !== prevProps.options ||
                    this.state.config === undefined ||
                    structureRev !== prevProps.structureRev ||
                    !structureRev;
                if (shouldReconfig) {
                    newState.config = prepConfig(alignedFrame, this.props.theme);
                }
            }
            newState && this.setState(newState);
        }
    };
    Histogram.prototype.render = function () {
        var _this = this;
        var _a = this.props, width = _a.width, height = _a.height, children = _a.children, alignedFrame = _a.alignedFrame;
        var config = this.state.config;
        if (!config) {
            return null;
        }
        return (React.createElement(VizLayout, { width: width, height: height, legend: this.renderLegend(config) }, function (vizWidth, vizHeight) { return (React.createElement(UPlotChart, { config: _this.state.config, data: _this.state.alignedData, width: vizWidth, height: vizHeight, timeRange: null }, children ? children(config, alignedFrame) : null)); }));
    };
    return Histogram;
}(React.Component));
export { Histogram };
//# sourceMappingURL=Histogram.js.map