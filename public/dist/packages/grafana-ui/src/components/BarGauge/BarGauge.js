import { __extends } from "tslib";
// Library
import React, { PureComponent } from 'react';
import tinycolor from 'tinycolor2';
import { formattedValueToString, GAUGE_DEFAULT_MAXIMUM, GAUGE_DEFAULT_MINIMUM, ThresholdsMode, FieldColorModeId, getFieldColorMode, FALLBACK_COLOR, VizOrientation, } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { FormattedValueDisplay } from '../FormattedValueDisplay/FormattedValueDisplay';
import { measureText, calculateFontSize } from '../../utils/measureText';
var MIN_VALUE_HEIGHT = 18;
var MAX_VALUE_HEIGHT = 50;
var MAX_VALUE_WIDTH = 150;
var TITLE_LINE_HEIGHT = 1.5;
var VALUE_LINE_HEIGHT = 1;
var VALUE_LEFT_PADDING = 10;
export var BarGaugeDisplayMode;
(function (BarGaugeDisplayMode) {
    BarGaugeDisplayMode["Basic"] = "basic";
    BarGaugeDisplayMode["Lcd"] = "lcd";
    BarGaugeDisplayMode["Gradient"] = "gradient";
})(BarGaugeDisplayMode || (BarGaugeDisplayMode = {}));
var BarGauge = /** @class */ (function (_super) {
    __extends(BarGauge, _super);
    function BarGauge() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    BarGauge.prototype.render = function () {
        var _a = this.props, onClick = _a.onClick, className = _a.className;
        var title = this.props.value.title;
        var styles = getTitleStyles(this.props);
        if (!title) {
            return (React.createElement("div", { style: styles.wrapper, onClick: onClick, className: className }, this.renderBarAndValue()));
        }
        return (React.createElement("div", { style: styles.wrapper, onClick: onClick, className: className },
            React.createElement("div", { style: styles.title }, title),
            this.renderBarAndValue()));
    };
    BarGauge.prototype.renderBarAndValue = function () {
        switch (this.props.displayMode) {
            case 'lcd':
                return this.renderRetroBars();
            case 'basic':
            case 'gradient':
            default:
                return this.renderBasicAndGradientBars();
        }
    };
    BarGauge.prototype.renderBasicAndGradientBars = function () {
        var _a = this.props, value = _a.value, showUnfilled = _a.showUnfilled;
        var styles = getBasicAndGradientStyles(this.props);
        return (React.createElement("div", { style: styles.wrapper },
            React.createElement(FormattedValueDisplay, { "aria-label": selectors.components.Panels.Visualization.BarGauge.value, value: value, style: styles.value }),
            showUnfilled && React.createElement("div", { style: styles.emptyBar }),
            React.createElement("div", { style: styles.bar })));
    };
    BarGauge.prototype.renderRetroBars = function () {
        var _a, _b;
        var _c = this.props, display = _c.display, field = _c.field, value = _c.value, itemSpacing = _c.itemSpacing, alignmentFactors = _c.alignmentFactors, orientation = _c.orientation, lcdCellWidth = _c.lcdCellWidth, text = _c.text;
        var _d = calculateBarAndValueDimensions(this.props), valueHeight = _d.valueHeight, valueWidth = _d.valueWidth, maxBarHeight = _d.maxBarHeight, maxBarWidth = _d.maxBarWidth, wrapperWidth = _d.wrapperWidth, wrapperHeight = _d.wrapperHeight;
        var minValue = (_a = field.min) !== null && _a !== void 0 ? _a : GAUGE_DEFAULT_MINIMUM;
        var maxValue = (_b = field.max) !== null && _b !== void 0 ? _b : GAUGE_DEFAULT_MAXIMUM;
        var isVert = isVertical(orientation);
        var valueRange = maxValue - minValue;
        var maxSize = isVert ? maxBarHeight : maxBarWidth;
        var cellSpacing = itemSpacing;
        var cellCount = Math.floor(maxSize / lcdCellWidth);
        var cellSize = Math.floor((maxSize - cellSpacing * cellCount) / cellCount);
        var valueColor = getValueColor(this.props);
        var valueToBaseSizeOn = alignmentFactors ? alignmentFactors : value;
        var valueStyles = getValueStyles(valueToBaseSizeOn, valueColor, valueWidth, valueHeight, orientation, text);
        var containerStyles = {
            width: wrapperWidth + "px",
            height: wrapperHeight + "px",
            display: 'flex',
        };
        if (isVert) {
            containerStyles.flexDirection = 'column-reverse';
            containerStyles.alignItems = 'center';
        }
        else {
            containerStyles.flexDirection = 'row';
            containerStyles.alignItems = 'center';
            valueStyles.justifyContent = 'flex-end';
        }
        var cells = [];
        for (var i = 0; i < cellCount; i++) {
            var currentValue = minValue + (valueRange / cellCount) * i;
            var cellColor = getCellColor(currentValue, value, display);
            var cellStyles = {
                borderRadius: '2px',
            };
            if (cellColor.isLit) {
                cellStyles.backgroundImage = "radial-gradient(" + cellColor.background + " 10%, " + cellColor.backgroundShade + ")";
            }
            else {
                cellStyles.backgroundColor = cellColor.background;
            }
            if (isVert) {
                cellStyles.height = cellSize + "px";
                cellStyles.width = maxBarWidth + "px";
                cellStyles.marginTop = cellSpacing + "px";
            }
            else {
                cellStyles.width = cellSize + "px";
                cellStyles.height = maxBarHeight + "px";
                cellStyles.marginRight = cellSpacing + "px";
            }
            cells.push(React.createElement("div", { key: i.toString(), style: cellStyles }));
        }
        return (React.createElement("div", { style: containerStyles },
            cells,
            React.createElement(FormattedValueDisplay, { "aria-label": selectors.components.Panels.Visualization.BarGauge.value, value: value, style: valueStyles })));
    };
    BarGauge.defaultProps = {
        lcdCellWidth: 12,
        value: {
            text: '100',
            numeric: 100,
        },
        displayMode: BarGaugeDisplayMode.Gradient,
        orientation: VizOrientation.Horizontal,
        field: {
            min: 0,
            max: 100,
            thresholds: {
                mode: ThresholdsMode.Absolute,
                steps: [],
            },
        },
        itemSpacing: 8,
        showUnfilled: true,
    };
    return BarGauge;
}(PureComponent));
export { BarGauge };
function isVertical(orientation) {
    return orientation === VizOrientation.Vertical;
}
function calculateTitleDimensions(props) {
    var _a, _b;
    var height = props.height, width = props.width, alignmentFactors = props.alignmentFactors, orientation = props.orientation, text = props.text;
    var title = alignmentFactors ? alignmentFactors.title : props.value.title;
    if (!title) {
        return { fontSize: 0, width: 0, height: 0, placement: 'above' };
    }
    if (isVertical(orientation)) {
        var fontSize = (_a = text === null || text === void 0 ? void 0 : text.titleSize) !== null && _a !== void 0 ? _a : 14;
        return {
            fontSize: fontSize,
            width: width,
            height: fontSize * TITLE_LINE_HEIGHT,
            placement: 'below',
        };
    }
    // if height above 40 put text to above bar
    if (height > 40) {
        if (text === null || text === void 0 ? void 0 : text.titleSize) {
            return {
                fontSize: text === null || text === void 0 ? void 0 : text.titleSize,
                width: 0,
                height: text.titleSize * TITLE_LINE_HEIGHT,
                placement: 'above',
            };
        }
        var maxTitleHeightRatio_1 = 0.45;
        var titleHeight_1 = Math.max(Math.min(height * maxTitleHeightRatio_1, MAX_VALUE_HEIGHT), 17);
        return {
            fontSize: titleHeight_1 / TITLE_LINE_HEIGHT,
            width: 0,
            height: titleHeight_1,
            placement: 'above',
        };
    }
    // title to left of bar scenario
    var maxTitleHeightRatio = 0.6;
    var titleHeight = Math.max(height * maxTitleHeightRatio, MIN_VALUE_HEIGHT);
    var titleFontSize = titleHeight / TITLE_LINE_HEIGHT;
    var textSize = measureText(title, titleFontSize);
    return {
        fontSize: (_b = text === null || text === void 0 ? void 0 : text.titleSize) !== null && _b !== void 0 ? _b : titleFontSize,
        height: 0,
        width: textSize.width + 15,
        placement: 'left',
    };
}
export function getTitleStyles(props) {
    var wrapperStyles = {
        display: 'flex',
        overflow: 'hidden',
        width: '100%',
    };
    var titleDim = calculateTitleDimensions(props);
    var titleStyles = {
        fontSize: titleDim.fontSize + "px",
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        width: '100%',
        alignItems: 'center',
        alignSelf: 'center',
    };
    if (isVertical(props.orientation)) {
        wrapperStyles.flexDirection = 'column-reverse';
        titleStyles.textAlign = 'center';
    }
    else {
        if (titleDim.placement === 'above') {
            wrapperStyles.flexDirection = 'column';
        }
        else {
            wrapperStyles.flexDirection = 'row';
            titleStyles.width = titleDim.width + "px";
            titleStyles.textAlign = 'right';
            titleStyles.paddingRight = '10px';
        }
    }
    return {
        wrapper: wrapperStyles,
        title: titleStyles,
    };
}
/**
 * @internal
 * Only exported for unit tests
 **/
export function calculateBarAndValueDimensions(props) {
    var _a;
    var height = props.height, width = props.width, orientation = props.orientation, text = props.text, alignmentFactors = props.alignmentFactors;
    var titleDim = calculateTitleDimensions(props);
    var value = alignmentFactors !== null && alignmentFactors !== void 0 ? alignmentFactors : props.value;
    var valueString = formattedValueToString(value);
    var maxBarHeight = 0;
    var maxBarWidth = 0;
    var valueHeight = 0;
    var valueWidth = 0;
    var wrapperWidth = 0;
    var wrapperHeight = 0;
    // measure text with title font size or min 14px
    var fontSizeToMeasureWith = (_a = text === null || text === void 0 ? void 0 : text.valueSize) !== null && _a !== void 0 ? _a : Math.max(titleDim.fontSize, 12);
    var realTextSize = measureText(valueString, fontSizeToMeasureWith);
    var realValueWidth = realTextSize.width + VALUE_LEFT_PADDING * 2;
    if (isVertical(orientation)) {
        if (text === null || text === void 0 ? void 0 : text.valueSize) {
            valueHeight = text.valueSize * VALUE_LINE_HEIGHT;
        }
        else {
            valueHeight = Math.min(Math.max(height * 0.1, MIN_VALUE_HEIGHT), MAX_VALUE_HEIGHT);
        }
        valueWidth = width;
        maxBarHeight = height - (titleDim.height + valueHeight);
        maxBarWidth = width;
        wrapperWidth = width;
        wrapperHeight = height - titleDim.height;
    }
    else {
        valueHeight = height - titleDim.height;
        valueWidth = Math.max(Math.min(width * 0.2, MAX_VALUE_WIDTH), realValueWidth);
        maxBarHeight = height - titleDim.height;
        maxBarWidth = width - valueWidth - titleDim.width;
        if (titleDim.placement === 'above') {
            wrapperWidth = width;
            wrapperHeight = height - titleDim.height;
        }
        else {
            wrapperWidth = width - titleDim.width;
            wrapperHeight = height;
        }
    }
    return {
        valueWidth: valueWidth,
        valueHeight: valueHeight,
        maxBarWidth: maxBarWidth,
        maxBarHeight: maxBarHeight,
        wrapperHeight: wrapperHeight,
        wrapperWidth: wrapperWidth,
    };
}
export function getCellColor(positionValue, value, display) {
    if (positionValue === null) {
        return {
            background: FALLBACK_COLOR,
            border: FALLBACK_COLOR,
        };
    }
    var color = display ? display(positionValue).color : null;
    if (color) {
        // if we are past real value the cell is not "on"
        if (value === null || isNaN(value.numeric) || (positionValue !== null && positionValue > value.numeric)) {
            return {
                background: tinycolor(color).setAlpha(0.18).toRgbString(),
                border: 'transparent',
                isLit: false,
            };
        }
        else {
            return {
                background: tinycolor(color).setAlpha(0.95).toRgbString(),
                backgroundShade: tinycolor(color).setAlpha(0.55).toRgbString(),
                border: tinycolor(color).setAlpha(0.9).toRgbString(),
                isLit: true,
            };
        }
    }
    return {
        background: FALLBACK_COLOR,
        border: FALLBACK_COLOR,
    };
}
export function getValuePercent(value, minValue, maxValue) {
    return Math.min((value - minValue) / (maxValue - minValue), 1);
}
/**
 * Only exported to for unit test
 */
export function getBasicAndGradientStyles(props) {
    var _a, _b;
    var displayMode = props.displayMode, field = props.field, value = props.value, alignmentFactors = props.alignmentFactors, orientation = props.orientation, theme = props.theme, text = props.text;
    var _c = calculateBarAndValueDimensions(props), valueWidth = _c.valueWidth, valueHeight = _c.valueHeight, maxBarHeight = _c.maxBarHeight, maxBarWidth = _c.maxBarWidth;
    var minValue = (_a = field.min) !== null && _a !== void 0 ? _a : GAUGE_DEFAULT_MINIMUM;
    var maxValue = (_b = field.max) !== null && _b !== void 0 ? _b : GAUGE_DEFAULT_MAXIMUM;
    var valuePercent = getValuePercent(value.numeric, minValue, maxValue);
    var valueColor = getValueColor(props);
    var valueToBaseSizeOn = alignmentFactors ? alignmentFactors : value;
    var valueStyles = getValueStyles(valueToBaseSizeOn, valueColor, valueWidth, valueHeight, orientation, text);
    var isBasic = displayMode === 'basic';
    var wrapperStyles = {
        display: 'flex',
        flexGrow: 1,
    };
    var barStyles = {
        borderRadius: '3px',
        position: 'relative',
        zIndex: 1,
    };
    var emptyBar = {
        background: "rgba(" + (theme.isDark ? '255,255,255' : '0,0,0') + ", 0.07)",
        flexGrow: 1,
        display: 'flex',
        borderRadius: '3px',
        position: 'relative',
    };
    if (isVertical(orientation)) {
        var barHeight = Math.max(valuePercent * maxBarHeight, 1);
        // vertical styles
        wrapperStyles.flexDirection = 'column';
        wrapperStyles.justifyContent = 'flex-end';
        barStyles.transition = 'height 1s';
        barStyles.height = barHeight + "px";
        barStyles.width = maxBarWidth + "px";
        // adjust so that filled in bar is at the bottom
        emptyBar.bottom = '-3px';
        if (isBasic) {
            // Basic styles
            barStyles.background = "" + tinycolor(valueColor).setAlpha(0.35).toRgbString();
            barStyles.borderTop = "2px solid " + valueColor;
        }
        else {
            // Gradient styles
            barStyles.background = getBarGradient(props, maxBarHeight);
        }
    }
    else {
        var barWidth = Math.max(valuePercent * maxBarWidth, 1);
        // Custom styles for horizontal orientation
        wrapperStyles.flexDirection = 'row-reverse';
        wrapperStyles.justifyContent = 'flex-end';
        wrapperStyles.alignItems = 'stretch';
        barStyles.transition = 'width 1s';
        barStyles.height = maxBarHeight + "px";
        barStyles.width = barWidth + "px";
        // shift empty region back to fill gaps due to border radius
        emptyBar.left = '-3px';
        if (isBasic) {
            // Basic styles
            barStyles.background = "" + tinycolor(valueColor).setAlpha(0.35).toRgbString();
            barStyles.borderRight = "2px solid " + valueColor;
        }
        else {
            // Gradient styles
            barStyles.background = getBarGradient(props, maxBarWidth);
        }
    }
    return {
        wrapper: wrapperStyles,
        bar: barStyles,
        value: valueStyles,
        emptyBar: emptyBar,
    };
}
/**
 * Only exported to for unit test
 */
export function getBarGradient(props, maxSize) {
    var _a, _b;
    var field = props.field, value = props.value, orientation = props.orientation, theme = props.theme;
    var cssDirection = isVertical(orientation) ? '0deg' : '90deg';
    var minValue = field.min;
    var maxValue = field.max;
    var gradient = '';
    var lastpos = 0;
    var mode = getFieldColorMode((_a = field.color) === null || _a === void 0 ? void 0 : _a.mode);
    if (mode.id === FieldColorModeId.Thresholds) {
        var thresholds = field.thresholds;
        for (var i = 0; i < thresholds.steps.length; i++) {
            var threshold = thresholds.steps[i];
            var color = props.theme.visualization.getColorByName(threshold.color);
            var valuePercent = thresholds.mode === ThresholdsMode.Percentage
                ? threshold.value / 100
                : getValuePercent(threshold.value, minValue, maxValue);
            var pos = valuePercent * maxSize;
            var offset = Math.round(pos - (pos - lastpos) / 2);
            var thresholdValue = thresholds.mode === ThresholdsMode.Percentage
                ? minValue + (maxValue - minValue) * valuePercent
                : threshold.value;
            if (gradient === '') {
                gradient = "linear-gradient(" + cssDirection + ", " + color + ", " + color;
            }
            else if (value.numeric < thresholdValue) {
                break;
            }
            else {
                lastpos = pos;
                gradient += " " + offset + "px, " + color;
            }
        }
        return gradient + ')';
    }
    if (mode.isContinuous && mode.getColors) {
        var scheme = mode.getColors(theme);
        for (var i = 0; i < scheme.length; i++) {
            var color = scheme[i];
            if (gradient === '') {
                gradient = "linear-gradient(" + cssDirection + ", " + color + " 0px";
            }
            else {
                var valuePercent = i / (scheme.length - 1);
                var pos = valuePercent * maxSize;
                gradient += ", " + color + " " + pos + "px";
            }
        }
        return gradient + ')';
    }
    return (_b = value.color) !== null && _b !== void 0 ? _b : FALLBACK_COLOR;
}
/**
 * Only exported to for unit test
 */
export function getValueColor(props) {
    var value = props.value;
    if (value.color) {
        return value.color;
    }
    return FALLBACK_COLOR;
}
function getValueStyles(value, color, width, height, orientation, text) {
    var _a, _b;
    var styles = {
        color: color,
        height: height + "px",
        width: width + "px",
        display: 'flex',
        alignItems: 'center',
        lineHeight: VALUE_LINE_HEIGHT,
    };
    // how many pixels in wide can the text be?
    var textWidth = width;
    var formattedValueString = formattedValueToString(value);
    if (isVertical(orientation)) {
        styles.fontSize = (_a = text === null || text === void 0 ? void 0 : text.valueSize) !== null && _a !== void 0 ? _a : calculateFontSize(formattedValueString, textWidth, height, VALUE_LINE_HEIGHT);
        styles.justifyContent = "center";
    }
    else {
        styles.fontSize =
            (_b = text === null || text === void 0 ? void 0 : text.valueSize) !== null && _b !== void 0 ? _b : calculateFontSize(formattedValueString, textWidth - VALUE_LEFT_PADDING * 2, height, VALUE_LINE_HEIGHT);
        styles.justifyContent = "flex-end";
        styles.paddingLeft = VALUE_LEFT_PADDING + "px";
        styles.paddingRight = VALUE_LEFT_PADDING + "px";
        // Need to remove the left padding from the text width constraints
        textWidth -= VALUE_LEFT_PADDING;
    }
    return styles;
}
//# sourceMappingURL=BarGauge.js.map