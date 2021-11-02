import { __assign, __extends, __makeTemplateObject } from "tslib";
// Libraries
import React, { PureComponent } from 'react';
// Utils
import { rangeUtil } from '@grafana/data';
// Components
import { Switch, Input, InlineField, InlineFormLabel, stylesFactory } from '@grafana/ui';
// Types
import { QueryOperationRow } from 'app/core/components/QueryOperationRow/QueryOperationRow';
import { config } from 'app/core/config';
import { css } from '@emotion/css';
var QueryGroupOptionsEditor = /** @class */ (function (_super) {
    __extends(QueryGroupOptionsEditor, _super);
    function QueryGroupOptionsEditor(props) {
        var _a, _b, _c, _d;
        var _this = _super.call(this, props) || this;
        _this.onRelativeTimeChange = function (event) {
            _this.setState({
                timeRangeFrom: event.target.value,
            });
        };
        _this.onTimeShiftChange = function (event) {
            _this.setState({
                timeRangeShift: event.target.value,
            });
        };
        _this.onOverrideTime = function (event) {
            var _a, _b;
            var _c = _this.props, options = _c.options, onChange = _c.onChange;
            var newValue = emptyToNull(event.target.value);
            var isValid = timeRangeValidation(newValue);
            if (isValid && ((_a = options.timeRange) === null || _a === void 0 ? void 0 : _a.from) !== newValue) {
                onChange(__assign(__assign({}, options), { timeRange: __assign(__assign({}, ((_b = options.timeRange) !== null && _b !== void 0 ? _b : {})), { from: newValue }) }));
            }
            _this.setState({ relativeTimeIsValid: isValid });
        };
        _this.onTimeShift = function (event) {
            var _a, _b;
            var _c = _this.props, options = _c.options, onChange = _c.onChange;
            var newValue = emptyToNull(event.target.value);
            var isValid = timeRangeValidation(newValue);
            if (isValid && ((_a = options.timeRange) === null || _a === void 0 ? void 0 : _a.shift) !== newValue) {
                onChange(__assign(__assign({}, options), { timeRange: __assign(__assign({}, ((_b = options.timeRange) !== null && _b !== void 0 ? _b : {})), { shift: newValue }) }));
            }
            _this.setState({ timeShiftIsValid: isValid });
        };
        _this.onToggleTimeOverride = function () {
            var _a = _this.props, onChange = _a.onChange, options = _a.options;
            _this.setState({ timeRangeHide: !_this.state.timeRangeHide }, function () {
                var _a;
                onChange(__assign(__assign({}, options), { timeRange: __assign(__assign({}, ((_a = options.timeRange) !== null && _a !== void 0 ? _a : {})), { hide: _this.state.timeRangeHide }) }));
            });
        };
        _this.onCacheTimeoutBlur = function (event) {
            var _a = _this.props, options = _a.options, onChange = _a.onChange;
            onChange(__assign(__assign({}, options), { cacheTimeout: emptyToNull(event.target.value) }));
        };
        _this.onMaxDataPointsBlur = function (event) {
            var _a = _this.props, options = _a.options, onChange = _a.onChange;
            var maxDataPoints = parseInt(event.target.value, 10);
            if (isNaN(maxDataPoints) || maxDataPoints === 0) {
                maxDataPoints = null;
            }
            if (maxDataPoints !== options.maxDataPoints) {
                onChange(__assign(__assign({}, options), { maxDataPoints: maxDataPoints }));
            }
        };
        _this.onMinIntervalBlur = function (event) {
            var _a = _this.props, options = _a.options, onChange = _a.onChange;
            var minInterval = emptyToNull(event.target.value);
            if (minInterval !== options.minInterval) {
                onChange(__assign(__assign({}, options), { minInterval: minInterval }));
            }
        };
        _this.onOpenOptions = function () {
            _this.setState({ isOpen: true });
        };
        _this.onCloseOptions = function () {
            _this.setState({ isOpen: false });
        };
        var options = props.options;
        _this.state = {
            timeRangeFrom: ((_a = options.timeRange) === null || _a === void 0 ? void 0 : _a.from) || '',
            timeRangeShift: ((_b = options.timeRange) === null || _b === void 0 ? void 0 : _b.shift) || '',
            timeRangeHide: (_d = (_c = options.timeRange) === null || _c === void 0 ? void 0 : _c.hide) !== null && _d !== void 0 ? _d : false,
            isOpen: false,
            relativeTimeIsValid: true,
            timeShiftIsValid: true,
        };
        return _this;
    }
    QueryGroupOptionsEditor.prototype.renderCacheTimeoutOption = function () {
        var _a, _b;
        var _c = this.props, dataSource = _c.dataSource, options = _c.options;
        var tooltip = "If your time series store has a query cache this option can override the default cache timeout. Specify a\n    numeric value in seconds.";
        if (!((_a = dataSource.meta.queryOptions) === null || _a === void 0 ? void 0 : _a.cacheTimeout)) {
            return null;
        }
        return (React.createElement("div", { className: "gf-form-inline" },
            React.createElement("div", { className: "gf-form" },
                React.createElement(InlineFormLabel, { width: 9, tooltip: tooltip }, "Cache timeout"),
                React.createElement(Input, { type: "text", className: "width-6", placeholder: "60", spellCheck: false, onBlur: this.onCacheTimeoutBlur, defaultValue: (_b = options.cacheTimeout) !== null && _b !== void 0 ? _b : '' }))));
    };
    QueryGroupOptionsEditor.prototype.renderMaxDataPointsOption = function () {
        var _a, _b;
        var _c = this.props, data = _c.data, options = _c.options;
        var realMd = (_a = data.request) === null || _a === void 0 ? void 0 : _a.maxDataPoints;
        var value = (_b = options.maxDataPoints) !== null && _b !== void 0 ? _b : '';
        var isAuto = value === '';
        return (React.createElement("div", { className: "gf-form-inline" },
            React.createElement("div", { className: "gf-form" },
                React.createElement(InlineFormLabel, { width: 9, tooltip: React.createElement(React.Fragment, null, "The maximum data points per series. Used directly by some data sources and used in calculation of auto interval. With streaming data this value is used for the rolling buffer.") }, "Max data points"),
                React.createElement(Input, { type: "number", className: "width-6", placeholder: "" + realMd, spellCheck: false, onBlur: this.onMaxDataPointsBlur, defaultValue: value }),
                isAuto && (React.createElement(React.Fragment, null,
                    React.createElement("div", { className: "gf-form-label query-segment-operator" }, "="),
                    React.createElement("div", { className: "gf-form-label" }, "Width of panel"))))));
    };
    QueryGroupOptionsEditor.prototype.renderIntervalOption = function () {
        var _a, _b, _c;
        var _d = this.props, data = _d.data, dataSource = _d.dataSource, options = _d.options;
        var realInterval = (_a = data.request) === null || _a === void 0 ? void 0 : _a.interval;
        var minIntervalOnDs = (_b = dataSource.interval) !== null && _b !== void 0 ? _b : 'No limit';
        return (React.createElement(React.Fragment, null,
            React.createElement("div", { className: "gf-form-inline" },
                React.createElement("div", { className: "gf-form" },
                    React.createElement(InlineFormLabel, { width: 9, tooltip: React.createElement(React.Fragment, null,
                            "A lower limit for the interval. Recommended to be set to write frequency, for example ",
                            React.createElement("code", null, "1m"),
                            ' ',
                            "if your data is written every minute. Default value can be set in data source settings for most data sources.") }, "Min interval"),
                    React.createElement(Input, { type: "text", className: "width-6", placeholder: "" + minIntervalOnDs, spellCheck: false, onBlur: this.onMinIntervalBlur, defaultValue: (_c = options.minInterval) !== null && _c !== void 0 ? _c : '' }))),
            React.createElement("div", { className: "gf-form-inline" },
                React.createElement("div", { className: "gf-form" },
                    React.createElement(InlineFormLabel, { width: 9, tooltip: React.createElement(React.Fragment, null,
                            "The evaluated interval that is sent to data source and is used in ",
                            React.createElement("code", null, "$__interval"),
                            " and",
                            ' ',
                            React.createElement("code", null, "$__interval_ms")) }, "Interval"),
                    React.createElement(InlineFormLabel, { width: 6 }, realInterval),
                    React.createElement("div", { className: "gf-form-label query-segment-operator" }, "="),
                    React.createElement("div", { className: "gf-form-label" }, "Time range / max data points")))));
    };
    QueryGroupOptionsEditor.prototype.renderCollapsedText = function (styles) {
        var _a;
        var _b = this.props, data = _b.data, options = _b.options;
        var isOpen = this.state.isOpen;
        if (isOpen) {
            return undefined;
        }
        var mdDesc = (_a = options.maxDataPoints) !== null && _a !== void 0 ? _a : '';
        if (mdDesc === '' && data.request) {
            mdDesc = "auto = " + data.request.maxDataPoints;
        }
        var intervalDesc = options.minInterval;
        if (data.request) {
            intervalDesc = "" + data.request.interval;
        }
        return (React.createElement(React.Fragment, null,
            React.createElement("div", { className: styles.collapsedText },
                "MD = ",
                mdDesc),
            React.createElement("div", { className: styles.collapsedText },
                "Interval = ",
                intervalDesc)));
    };
    QueryGroupOptionsEditor.prototype.render = function () {
        var _a = this.state, hideTimeOverride = _a.timeRangeHide, relativeTimeIsValid = _a.relativeTimeIsValid, timeShiftIsValid = _a.timeShiftIsValid;
        var _b = this.state, relativeTime = _b.timeRangeFrom, timeShift = _b.timeRangeShift, isOpen = _b.isOpen;
        var styles = getStyles();
        return (React.createElement(QueryOperationRow, { id: "Query options", index: 0, title: "Query options", headerElement: this.renderCollapsedText(styles), isOpen: isOpen, onOpen: this.onOpenOptions, onClose: this.onCloseOptions },
            this.renderMaxDataPointsOption(),
            this.renderIntervalOption(),
            this.renderCacheTimeoutOption(),
            React.createElement("div", { className: "gf-form" },
                React.createElement(InlineFormLabel, { width: 9 }, "Relative time"),
                React.createElement(Input, { type: "text", className: "width-6", placeholder: "1h", onChange: this.onRelativeTimeChange, onBlur: this.onOverrideTime, invalid: !relativeTimeIsValid, value: relativeTime })),
            React.createElement("div", { className: "gf-form" },
                React.createElement("span", { className: "gf-form-label width-9" }, "Time shift"),
                React.createElement(Input, { type: "text", className: "width-6", placeholder: "1h", onChange: this.onTimeShiftChange, onBlur: this.onTimeShift, invalid: !timeShiftIsValid, value: timeShift })),
            (timeShift || relativeTime) && (React.createElement("div", { className: "gf-form-inline" },
                React.createElement(InlineField, { label: "Hide time info", labelWidth: 18 },
                    React.createElement(Switch, { value: hideTimeOverride, onChange: this.onToggleTimeOverride }))))));
    };
    return QueryGroupOptionsEditor;
}(PureComponent));
export { QueryGroupOptionsEditor };
var timeRangeValidation = function (value) {
    if (!value) {
        return true;
    }
    return rangeUtil.isValidTimeSpan(value);
};
var emptyToNull = function (value) {
    return value === '' ? null : value;
};
var getStyles = stylesFactory(function () {
    var theme = config.theme;
    return {
        collapsedText: css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n      margin-left: ", ";\n      font-size: ", ";\n      color: ", ";\n    "], ["\n      margin-left: ", ";\n      font-size: ", ";\n      color: ", ";\n    "])), theme.spacing.md, theme.typography.size.sm, theme.colors.textWeak),
    };
});
var templateObject_1;
//# sourceMappingURL=QueryGroupOptions.js.map