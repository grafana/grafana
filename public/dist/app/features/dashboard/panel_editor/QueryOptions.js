import * as tslib_1 from "tslib";
var _a;
// Libraries
import React, { PureComponent } from 'react';
// Utils
import { isValidTimeSpan } from 'app/core/utils/rangeutil';
// Components
import { Switch } from '@grafana/ui';
import { Input } from 'app/core/components/Form';
import { EventsWithValidation } from 'app/core/components/Form/Input';
import { InputStatus } from 'app/core/components/Form/Input';
import { DataSourceOption } from './DataSourceOption';
import { FormLabel } from '@grafana/ui';
var timeRangeValidationEvents = (_a = {},
    _a[EventsWithValidation.onBlur] = [
        {
            rule: function (value) {
                if (!value) {
                    return true;
                }
                return isValidTimeSpan(value);
            },
            errorMessage: 'Not a valid timespan',
        },
    ],
    _a);
var emptyToNull = function (value) {
    return value === '' ? null : value;
};
var QueryOptions = /** @class */ (function (_super) {
    tslib_1.__extends(QueryOptions, _super);
    function QueryOptions(props) {
        var _this = _super.call(this, props) || this;
        _this.allOptions = {
            cacheTimeout: {
                label: 'Cache timeout',
                placeholder: '60',
                name: 'cacheTimeout',
                tooltipInfo: (React.createElement(React.Fragment, null, "If your time series store has a query cache this option can override the default cache timeout. Specify a numeric value in seconds.")),
            },
            maxDataPoints: {
                label: 'Max data points',
                placeholder: 'auto',
                name: 'maxDataPoints',
                tooltipInfo: (React.createElement(React.Fragment, null, "The maximum data points the query should return. For graphs this is automatically set to one data point per pixel.")),
            },
            minInterval: {
                label: 'Min time interval',
                placeholder: '0',
                name: 'minInterval',
                panelKey: 'interval',
                tooltipInfo: (React.createElement(React.Fragment, null,
                    "A lower limit for the auto group by time interval. Recommended to be set to write frequency, for example",
                    ' ',
                    React.createElement("code", null, "1m"),
                    " if your data is written every minute. Access auto interval via variable",
                    ' ',
                    React.createElement("code", null, "$__interval"),
                    " for time range string and ",
                    React.createElement("code", null, "$__interval_ms"),
                    " for numeric variable that can be used in math expressions.")),
            },
        };
        _this.onRelativeTimeChange = function (event) {
            _this.setState({
                relativeTime: event.target.value,
            });
        };
        _this.onTimeShiftChange = function (event) {
            _this.setState({
                timeShift: event.target.value,
            });
        };
        _this.onOverrideTime = function (event, status) {
            var value = event.target.value;
            var panel = _this.props.panel;
            var emptyToNullValue = emptyToNull(value);
            if (status === InputStatus.Valid && panel.timeFrom !== emptyToNullValue) {
                panel.timeFrom = emptyToNullValue;
                panel.refresh();
            }
        };
        _this.onTimeShift = function (event, status) {
            var value = event.target.value;
            var panel = _this.props.panel;
            var emptyToNullValue = emptyToNull(value);
            if (status === InputStatus.Valid && panel.timeShift !== emptyToNullValue) {
                panel.timeShift = emptyToNullValue;
                panel.refresh();
            }
        };
        _this.onToggleTimeOverride = function () {
            var panel = _this.props.panel;
            _this.setState({ hideTimeOverride: !_this.state.hideTimeOverride }, function () {
                panel.hideTimeOverride = _this.state.hideTimeOverride;
                panel.refresh();
            });
        };
        _this.onDataSourceOptionBlur = function (panelKey) { return function () {
            var panel = _this.props.panel;
            panel[panelKey] = _this.state[panelKey];
            panel.refresh();
        }; };
        _this.onDataSourceOptionChange = function (panelKey) { return function (event) {
            var _a;
            _this.setState(tslib_1.__assign({}, _this.state, (_a = {}, _a[panelKey] = event.target.value, _a)));
        }; };
        _this.renderOptions = function () {
            var datasource = _this.props.datasource;
            var queryOptions = datasource.meta.queryOptions;
            if (!queryOptions) {
                return null;
            }
            return Object.keys(queryOptions).map(function (key) {
                var options = _this.allOptions[key];
                var panelKey = options.panelKey || key;
                return (React.createElement(DataSourceOption, tslib_1.__assign({ key: key }, options, { onChange: _this.onDataSourceOptionChange(panelKey), onBlur: _this.onDataSourceOptionBlur(panelKey), value: _this.state[panelKey] })));
            });
        };
        _this.state = {
            relativeTime: props.panel.timeFrom || '',
            timeShift: props.panel.timeShift || '',
            cacheTimeout: props.panel.cacheTimeout || '',
            maxDataPoints: props.panel.maxDataPoints || '',
            interval: props.panel.interval || '',
            hideTimeOverride: props.panel.hideTimeOverride || false,
        };
        return _this;
    }
    QueryOptions.prototype.render = function () {
        var hideTimeOverride = this.state.hideTimeOverride;
        var _a = this.state, relativeTime = _a.relativeTime, timeShift = _a.timeShift;
        return (React.createElement("div", { className: "gf-form-inline" },
            this.renderOptions(),
            React.createElement("div", { className: "gf-form" },
                React.createElement(FormLabel, null, "Relative time"),
                React.createElement(Input, { type: "text", className: "width-6", placeholder: "1h", onChange: this.onRelativeTimeChange, onBlur: this.onOverrideTime, validationEvents: timeRangeValidationEvents, hideErrorMessage: true, value: relativeTime })),
            React.createElement("div", { className: "gf-form" },
                React.createElement("span", { className: "gf-form-label" }, "Time shift"),
                React.createElement(Input, { type: "text", className: "width-6", placeholder: "1h", onChange: this.onTimeShiftChange, onBlur: this.onTimeShift, validationEvents: timeRangeValidationEvents, hideErrorMessage: true, value: timeShift })),
            (timeShift || relativeTime) && (React.createElement("div", { className: "gf-form-inline" },
                React.createElement(Switch, { label: "Hide time info", checked: hideTimeOverride, onChange: this.onToggleTimeOverride })))));
    };
    return QueryOptions;
}(PureComponent));
export { QueryOptions };
//# sourceMappingURL=QueryOptions.js.map