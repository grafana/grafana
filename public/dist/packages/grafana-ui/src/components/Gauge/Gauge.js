import { __extends } from "tslib";
import React, { PureComponent } from 'react';
import $ from 'jquery';
import { formattedValueToString, ThresholdsMode, GAUGE_DEFAULT_MAXIMUM, GAUGE_DEFAULT_MINIMUM, getActiveThreshold, getColorForTheme, FieldColorModeId, FALLBACK_COLOR, } from '@grafana/data';
import { calculateFontSize } from '../../utils/measureText';
var Gauge = /** @class */ (function (_super) {
    __extends(Gauge, _super);
    function Gauge() {
        var _this = _super !== null && _super.apply(this, arguments) || this;
        _this.renderVisualization = function () {
            var _a;
            var _b = _this.props, width = _b.width, value = _b.value, height = _b.height, onClick = _b.onClick, text = _b.text;
            var autoProps = calculateGaugeAutoProps(width, height, value.title);
            return (React.createElement(React.Fragment, null,
                React.createElement("div", { style: { height: autoProps.gaugeHeight + "px", width: '100%' }, ref: function (element) { return (_this.canvasElement = element); }, onClick: onClick }),
                autoProps.showLabel && (React.createElement("div", { style: {
                        textAlign: 'center',
                        fontSize: (_a = text === null || text === void 0 ? void 0 : text.titleSize) !== null && _a !== void 0 ? _a : autoProps.titleFontSize,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        position: 'relative',
                        width: '100%',
                        top: '-4px',
                        cursor: 'default',
                    } }, value.title))));
        };
        return _this;
    }
    Gauge.prototype.componentDidMount = function () {
        this.draw();
    };
    Gauge.prototype.componentDidUpdate = function () {
        this.draw();
    };
    Gauge.prototype.getFormattedThresholds = function (decimals) {
        var _a, _b, _c, _d, _e, _f, _g;
        var _h = this.props, field = _h.field, theme = _h.theme, value = _h.value;
        if (((_a = field.color) === null || _a === void 0 ? void 0 : _a.mode) !== FieldColorModeId.Thresholds) {
            return [{ value: (_b = field.min) !== null && _b !== void 0 ? _b : GAUGE_DEFAULT_MINIMUM, color: (_c = value.color) !== null && _c !== void 0 ? _c : FALLBACK_COLOR }];
        }
        var thresholds = (_d = field.thresholds) !== null && _d !== void 0 ? _d : (_e = Gauge.defaultProps.field) === null || _e === void 0 ? void 0 : _e.thresholds;
        var isPercent = thresholds.mode === ThresholdsMode.Percentage;
        var steps = thresholds.steps;
        var min = (_f = field.min) !== null && _f !== void 0 ? _f : GAUGE_DEFAULT_MINIMUM;
        var max = (_g = field.max) !== null && _g !== void 0 ? _g : GAUGE_DEFAULT_MAXIMUM;
        if (isPercent) {
            min = 0;
            max = 100;
        }
        var first = getActiveThreshold(min, steps);
        var last = getActiveThreshold(max, steps);
        var formatted = [];
        formatted.push({ value: +min.toFixed(decimals), color: getColorForTheme(first.color, theme) });
        var skip = true;
        for (var i = 0; i < steps.length; i++) {
            var step = steps[i];
            if (skip) {
                if (first === step) {
                    skip = false;
                }
                continue;
            }
            var prev = steps[i - 1];
            formatted.push({ value: step.value, color: getColorForTheme(prev.color, theme) });
            if (step === last) {
                break;
            }
        }
        formatted.push({ value: +max.toFixed(decimals), color: getColorForTheme(last.color, theme) });
        return formatted;
    };
    Gauge.prototype.draw = function () {
        var _a, _b, _c, _d, _e;
        var _f = this.props, field = _f.field, showThresholdLabels = _f.showThresholdLabels, showThresholdMarkers = _f.showThresholdMarkers, width = _f.width, height = _f.height, theme = _f.theme, value = _f.value;
        var autoProps = calculateGaugeAutoProps(width, height, value.title);
        var dimension = Math.min(width, autoProps.gaugeHeight);
        var backgroundColor = theme.colors.bg2;
        var gaugeWidthReduceRatio = showThresholdLabels ? 1.5 : 1;
        var gaugeWidth = Math.min(dimension / 5.5, 40) / gaugeWidthReduceRatio;
        var thresholdMarkersWidth = gaugeWidth / 5;
        var text = formattedValueToString(value);
        // This not 100% accurate as I am unsure of flot's calculations here
        var valueWidthBase = Math.min(width, dimension * 1.3) * 0.9;
        // remove gauge & marker width (on left and right side)
        // and 10px is some padding that flot adds to the outer canvas
        var valueWidth = valueWidthBase -
            ((gaugeWidth + (showThresholdMarkers ? thresholdMarkersWidth : 0) + (showThresholdLabels ? 10 : 0)) * 2 + 10);
        var fontSize = (_b = (_a = this.props.text) === null || _a === void 0 ? void 0 : _a.valueSize) !== null && _b !== void 0 ? _b : calculateFontSize(text, valueWidth, dimension, 1, gaugeWidth * 1.7);
        var thresholdLabelFontSize = Math.max(fontSize / 2.5, 12);
        var min = (_c = field.min) !== null && _c !== void 0 ? _c : GAUGE_DEFAULT_MINIMUM;
        var max = (_d = field.max) !== null && _d !== void 0 ? _d : GAUGE_DEFAULT_MAXIMUM;
        var numeric = value.numeric;
        if (((_e = field.thresholds) === null || _e === void 0 ? void 0 : _e.mode) === ThresholdsMode.Percentage) {
            min = 0;
            max = 100;
            if (value.percent === undefined) {
                numeric = ((numeric - min) / (max - min)) * 100;
            }
            else {
                numeric = value.percent * 100;
            }
        }
        var decimals = field.decimals === undefined ? 2 : field.decimals;
        if (showThresholdMarkers) {
            min = +min.toFixed(decimals);
            max = +max.toFixed(decimals);
        }
        var options = {
            series: {
                gauges: {
                    gauge: {
                        min: min,
                        max: max,
                        background: { color: backgroundColor },
                        border: { color: null },
                        shadow: { show: false },
                        width: gaugeWidth,
                    },
                    frame: { show: false },
                    label: { show: false },
                    layout: { margin: 0, thresholdWidth: 0, vMargin: 0 },
                    cell: { border: { width: 0 } },
                    threshold: {
                        values: this.getFormattedThresholds(decimals),
                        label: {
                            show: showThresholdLabels,
                            margin: thresholdMarkersWidth + 1,
                            font: { size: thresholdLabelFontSize },
                        },
                        show: showThresholdMarkers,
                        width: thresholdMarkersWidth,
                    },
                    value: {
                        color: value.color,
                        formatter: function () {
                            return text;
                        },
                        font: { size: fontSize, family: theme.typography.fontFamily.sansSerif },
                    },
                    show: true,
                },
            },
        };
        var plotSeries = {
            data: [[0, numeric]],
            label: value.title,
        };
        try {
            $.plot(this.canvasElement, [plotSeries], options);
        }
        catch (err) {
            console.error('Gauge rendering error', err, options, value);
        }
    };
    Gauge.prototype.render = function () {
        return (React.createElement("div", { style: {
                width: '100%',
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                overflow: 'hidden',
            }, className: this.props.className }, this.renderVisualization()));
    };
    Gauge.defaultProps = {
        showThresholdMarkers: true,
        showThresholdLabels: false,
        field: {
            min: 0,
            max: 100,
            thresholds: {
                mode: ThresholdsMode.Absolute,
                steps: [
                    { value: -Infinity, color: 'green' },
                    { value: 80, color: 'red' },
                ],
            },
        },
    };
    return Gauge;
}(PureComponent));
export { Gauge };
function calculateGaugeAutoProps(width, height, title) {
    var showLabel = title !== null && title !== undefined;
    var titleFontSize = Math.min((width * 0.15) / 1.5, 20); // 20% of height * line-height, max 40px
    var titleHeight = titleFontSize * 1.5;
    var availableHeight = showLabel ? height - titleHeight : height;
    var gaugeHeight = Math.min(availableHeight, width);
    return {
        showLabel: showLabel,
        gaugeHeight: gaugeHeight,
        titleFontSize: titleFontSize,
    };
}
//# sourceMappingURL=Gauge.js.map