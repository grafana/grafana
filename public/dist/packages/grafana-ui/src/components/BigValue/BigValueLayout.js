import { __assign, __extends } from "tslib";
// Libraries
import React from 'react';
import tinycolor from 'tinycolor2';
// Utils
import { formattedValueToString, FieldType } from '@grafana/data';
import { calculateFontSize } from '../../utils/measureText';
// Types
import { BigValueColorMode, BigValueJustifyMode, BigValueTextMode } from './BigValue';
import { getTextColorForBackground } from '../../utils';
import { GraphDrawStyle } from '@grafana/schema';
import { Sparkline } from '../Sparkline/Sparkline';
var LINE_HEIGHT = 1.2;
var MAX_TITLE_SIZE = 30;
var BigValueLayout = /** @class */ (function () {
    function BigValueLayout(props) {
        var _a;
        this.props = props;
        var width = props.width, height = props.height, value = props.value, text = props.text;
        this.valueColor = (_a = value.color) !== null && _a !== void 0 ? _a : 'gray';
        this.panelPadding = height > 100 ? 12 : 8;
        this.textValues = getTextValues(props);
        this.justifyCenter = shouldJustifyCenter(props.justifyMode, this.textValues.title);
        this.valueToAlignTo = this.textValues.valueToAlignTo;
        this.titleToAlignTo = this.textValues.titleToAlignTo;
        this.titleFontSize = 14;
        this.valueFontSize = 14;
        this.chartHeight = 0;
        this.chartWidth = 0;
        this.maxTextWidth = width - this.panelPadding * 2;
        this.maxTextHeight = height - this.panelPadding * 2;
        // Explicit font sizing
        if (text) {
            if (text.titleSize) {
                this.titleFontSize = text.titleSize;
                this.titleToAlignTo = undefined;
            }
            if (text.valueSize) {
                this.valueFontSize = text.valueSize;
                this.valueToAlignTo = '';
            }
        }
    }
    BigValueLayout.prototype.getTitleStyles = function () {
        var styles = {
            fontSize: this.titleFontSize + "px",
            lineHeight: LINE_HEIGHT,
        };
        if (this.props.colorMode === BigValueColorMode.Background) {
            styles.color = getTextColorForBackground(this.valueColor);
        }
        return styles;
    };
    BigValueLayout.prototype.getValueStyles = function () {
        var styles = {
            fontSize: this.valueFontSize,
            fontWeight: 500,
            lineHeight: LINE_HEIGHT,
            position: 'relative',
            zIndex: 1,
        };
        if (this.justifyCenter) {
            styles.textAlign = 'center';
        }
        switch (this.props.colorMode) {
            case BigValueColorMode.Value:
                styles.color = this.valueColor;
                break;
            case BigValueColorMode.Background:
                styles.color = getTextColorForBackground(this.valueColor);
                break;
            case BigValueColorMode.None:
                styles.color = this.props.theme.colors.text.primary;
                break;
        }
        return styles;
    };
    BigValueLayout.prototype.getValueAndTitleContainerStyles = function () {
        var styles = {
            display: 'flex',
        };
        if (this.justifyCenter) {
            styles.alignItems = 'center';
            styles.justifyContent = 'center';
            styles.flexGrow = 1;
        }
        return styles;
    };
    BigValueLayout.prototype.getPanelStyles = function () {
        var _a = this.props, width = _a.width, height = _a.height, theme = _a.theme, colorMode = _a.colorMode;
        var panelStyles = {
            width: width + "px",
            height: height + "px",
            padding: this.panelPadding + "px",
            borderRadius: '3px',
            position: 'relative',
            display: 'flex',
        };
        var themeFactor = theme.isDark ? 1 : -0.7;
        switch (colorMode) {
            case BigValueColorMode.Background:
                var bgColor2 = tinycolor(this.valueColor)
                    .darken(15 * themeFactor)
                    .spin(8)
                    .toRgbString();
                var bgColor3 = tinycolor(this.valueColor)
                    .darken(5 * themeFactor)
                    .spin(-8)
                    .toRgbString();
                panelStyles.background = "linear-gradient(120deg, " + bgColor2 + ", " + bgColor3 + ")";
                break;
            case BigValueColorMode.Value:
                panelStyles.background = "transparent";
                break;
        }
        if (this.justifyCenter) {
            panelStyles.alignItems = 'center';
            panelStyles.flexDirection = 'row';
        }
        return panelStyles;
    };
    BigValueLayout.prototype.renderChart = function () {
        var _a;
        var _b = this.props, sparkline = _b.sparkline, colorMode = _b.colorMode;
        if (!sparkline || ((_a = sparkline.y) === null || _a === void 0 ? void 0 : _a.type) !== FieldType.number) {
            return null;
        }
        var fillColor;
        var lineColor;
        switch (colorMode) {
            case BigValueColorMode.Background:
                fillColor = 'rgba(255,255,255,0.4)';
                lineColor = tinycolor(this.valueColor).brighten(40).toRgbString();
                break;
            case BigValueColorMode.None:
            case BigValueColorMode.Value:
            default:
                lineColor = this.valueColor;
                fillColor = tinycolor(this.valueColor).setAlpha(0.2).toRgbString();
                break;
        }
        // The graph field configuration applied to Y values
        var config = {
            custom: {
                drawStyle: GraphDrawStyle.Line,
                lineWidth: 1,
                fillColor: fillColor,
                lineColor: lineColor,
            },
        };
        return (React.createElement("div", { style: this.getChartStyles() },
            React.createElement(Sparkline, { height: this.chartHeight, width: this.chartWidth, sparkline: sparkline, config: config, theme: this.props.theme })));
    };
    BigValueLayout.prototype.getChartStyles = function () {
        return {
            position: 'absolute',
            right: 0,
            bottom: 0,
        };
    };
    return BigValueLayout;
}());
export { BigValueLayout };
var WideNoChartLayout = /** @class */ (function (_super) {
    __extends(WideNoChartLayout, _super);
    function WideNoChartLayout(props) {
        var _a, _b;
        var _this = _super.call(this, props) || this;
        var valueWidthPercent = ((_a = _this.titleToAlignTo) === null || _a === void 0 ? void 0 : _a.length) ? 0.3 : 1.0;
        if (_this.valueToAlignTo.length) {
            // initial value size
            _this.valueFontSize = calculateFontSize(_this.valueToAlignTo, _this.maxTextWidth * valueWidthPercent, _this.maxTextHeight, LINE_HEIGHT);
        }
        if ((_b = _this.titleToAlignTo) === null || _b === void 0 ? void 0 : _b.length) {
            // How big can we make the title and still have it fit
            _this.titleFontSize = calculateFontSize(_this.titleToAlignTo, _this.maxTextWidth * 0.6, _this.maxTextHeight, LINE_HEIGHT, MAX_TITLE_SIZE);
            // make sure it's a bit smaller than valueFontSize
            _this.titleFontSize = Math.min(_this.valueFontSize * 0.7, _this.titleFontSize);
        }
        return _this;
    }
    WideNoChartLayout.prototype.getValueAndTitleContainerStyles = function () {
        var styles = _super.prototype.getValueAndTitleContainerStyles.call(this);
        styles.flexDirection = 'row';
        styles.alignItems = 'center';
        styles.flexGrow = 1;
        if (!this.justifyCenter) {
            styles.justifyContent = 'space-between';
        }
        return styles;
    };
    WideNoChartLayout.prototype.renderChart = function () {
        return null;
    };
    WideNoChartLayout.prototype.getPanelStyles = function () {
        var panelStyles = _super.prototype.getPanelStyles.call(this);
        panelStyles.alignItems = 'center';
        return panelStyles;
    };
    return WideNoChartLayout;
}(BigValueLayout));
export { WideNoChartLayout };
var WideWithChartLayout = /** @class */ (function (_super) {
    __extends(WideWithChartLayout, _super);
    function WideWithChartLayout(props) {
        var _a;
        var _this = _super.call(this, props) || this;
        var width = props.width, height = props.height;
        var chartHeightPercent = 0.5;
        var titleWidthPercent = 0.6;
        var valueWidthPercent = 1 - titleWidthPercent;
        var textHeightPercent = 0.4;
        _this.chartWidth = width;
        _this.chartHeight = height * chartHeightPercent;
        if ((_a = _this.titleToAlignTo) === null || _a === void 0 ? void 0 : _a.length) {
            _this.titleFontSize = calculateFontSize(_this.titleToAlignTo, _this.maxTextWidth * titleWidthPercent, _this.maxTextHeight * textHeightPercent, LINE_HEIGHT, MAX_TITLE_SIZE);
        }
        if (_this.valueToAlignTo.length) {
            _this.valueFontSize = calculateFontSize(_this.valueToAlignTo, _this.maxTextWidth * valueWidthPercent, _this.maxTextHeight * chartHeightPercent, LINE_HEIGHT);
        }
        return _this;
    }
    WideWithChartLayout.prototype.getValueAndTitleContainerStyles = function () {
        var styles = _super.prototype.getValueAndTitleContainerStyles.call(this);
        styles.flexDirection = 'row';
        styles.flexGrow = 1;
        if (!this.justifyCenter) {
            styles.justifyContent = 'space-between';
        }
        return styles;
    };
    WideWithChartLayout.prototype.getPanelStyles = function () {
        var styles = _super.prototype.getPanelStyles.call(this);
        styles.flexDirection = 'row';
        styles.justifyContent = 'space-between';
        return styles;
    };
    return WideWithChartLayout;
}(BigValueLayout));
export { WideWithChartLayout };
var StackedWithChartLayout = /** @class */ (function (_super) {
    __extends(StackedWithChartLayout, _super);
    function StackedWithChartLayout(props) {
        var _a, _b;
        var _this = _super.call(this, props) || this;
        var width = props.width, height = props.height;
        var titleHeightPercent = 0.15;
        var chartHeightPercent = 0.25;
        var titleHeight = 0;
        _this.chartHeight = height * chartHeightPercent;
        _this.chartWidth = width;
        if ((_a = _this.titleToAlignTo) === null || _a === void 0 ? void 0 : _a.length) {
            _this.titleFontSize = calculateFontSize(_this.titleToAlignTo, _this.maxTextWidth, height * titleHeightPercent, LINE_HEIGHT, MAX_TITLE_SIZE);
        }
        titleHeight = _this.titleFontSize * LINE_HEIGHT;
        if (_this.valueToAlignTo.length) {
            _this.valueFontSize = calculateFontSize(_this.valueToAlignTo, _this.maxTextWidth, _this.maxTextHeight - _this.chartHeight - titleHeight, LINE_HEIGHT);
        }
        // make title fontsize it's a bit smaller than valueFontSize
        if ((_b = _this.titleToAlignTo) === null || _b === void 0 ? void 0 : _b.length) {
            _this.titleFontSize = Math.min(_this.valueFontSize * 0.7, _this.titleFontSize);
        }
        // make chart take up unused space
        _this.chartHeight = height - _this.titleFontSize * LINE_HEIGHT - _this.valueFontSize * LINE_HEIGHT;
        return _this;
    }
    StackedWithChartLayout.prototype.getValueAndTitleContainerStyles = function () {
        var styles = _super.prototype.getValueAndTitleContainerStyles.call(this);
        styles.flexDirection = 'column';
        styles.justifyContent = 'center';
        return styles;
    };
    StackedWithChartLayout.prototype.getPanelStyles = function () {
        var styles = _super.prototype.getPanelStyles.call(this);
        styles.flexDirection = 'column';
        return styles;
    };
    return StackedWithChartLayout;
}(BigValueLayout));
export { StackedWithChartLayout };
var StackedWithNoChartLayout = /** @class */ (function (_super) {
    __extends(StackedWithNoChartLayout, _super);
    function StackedWithNoChartLayout(props) {
        var _a;
        var _this = _super.call(this, props) || this;
        var height = props.height;
        var titleHeightPercent = 0.15;
        var titleHeight = 0;
        if ((_a = _this.titleToAlignTo) === null || _a === void 0 ? void 0 : _a.length) {
            _this.titleFontSize = calculateFontSize(_this.titleToAlignTo, _this.maxTextWidth, height * titleHeightPercent, LINE_HEIGHT, MAX_TITLE_SIZE);
            titleHeight = _this.titleFontSize * LINE_HEIGHT;
        }
        if (_this.valueToAlignTo.length) {
            _this.valueFontSize = calculateFontSize(_this.valueToAlignTo, _this.maxTextWidth, _this.maxTextHeight - titleHeight, LINE_HEIGHT);
        }
        // make title fontsize it's a bit smaller than valueFontSize
        _this.titleFontSize = Math.min(_this.valueFontSize * 0.7, _this.titleFontSize);
        return _this;
    }
    StackedWithNoChartLayout.prototype.getValueAndTitleContainerStyles = function () {
        var styles = _super.prototype.getValueAndTitleContainerStyles.call(this);
        styles.flexDirection = 'column';
        styles.flexGrow = 1;
        return styles;
    };
    StackedWithNoChartLayout.prototype.getPanelStyles = function () {
        var styles = _super.prototype.getPanelStyles.call(this);
        styles.alignItems = 'center';
        return styles;
    };
    return StackedWithNoChartLayout;
}(BigValueLayout));
export { StackedWithNoChartLayout };
export function buildLayout(props) {
    var width = props.width, height = props.height, sparkline = props.sparkline;
    var useWideLayout = width / height > 2.5;
    if (useWideLayout) {
        if (height > 50 && !!sparkline) {
            return new WideWithChartLayout(props);
        }
        else {
            return new WideNoChartLayout(props);
        }
    }
    // stacked layouts
    if (height > 100 && !!sparkline) {
        return new StackedWithChartLayout(props);
    }
    else {
        return new StackedWithNoChartLayout(props);
    }
}
export function shouldJustifyCenter(justifyMode, title) {
    if (justifyMode === BigValueJustifyMode.Center) {
        return true;
    }
    return (title !== null && title !== void 0 ? title : '').length === 0;
}
function getTextValues(props) {
    var value = props.value, alignmentFactors = props.alignmentFactors, count = props.count;
    var textMode = props.textMode;
    var titleToAlignTo = alignmentFactors ? alignmentFactors.title : value.title;
    var valueToAlignTo = formattedValueToString(alignmentFactors ? alignmentFactors : value);
    // In the auto case we only show title if this big value is part of more panes (count > 1)
    if (textMode === BigValueTextMode.Auto && (count !== null && count !== void 0 ? count : 1) === 1) {
        textMode = BigValueTextMode.Value;
    }
    switch (textMode) {
        case BigValueTextMode.Name:
            return __assign(__assign({}, value), { title: undefined, prefix: undefined, suffix: undefined, text: value.title || '', titleToAlignTo: undefined, valueToAlignTo: titleToAlignTo !== null && titleToAlignTo !== void 0 ? titleToAlignTo : '', tooltip: formattedValueToString(value) });
        case BigValueTextMode.Value:
            return __assign(__assign({}, value), { title: undefined, titleToAlignTo: undefined, valueToAlignTo: valueToAlignTo, tooltip: value.title });
        case BigValueTextMode.None:
            return {
                numeric: value.numeric,
                color: value.color,
                title: undefined,
                text: '',
                titleToAlignTo: undefined,
                valueToAlignTo: '1',
                tooltip: "Name: " + value.title + "\nValue: " + formattedValueToString(value),
            };
        case BigValueTextMode.ValueAndName:
        default:
            return __assign(__assign({}, value), { titleToAlignTo: titleToAlignTo, valueToAlignTo: valueToAlignTo });
    }
}
//# sourceMappingURL=BigValueLayout.js.map