import { css } from '@emotion/css';
import React, { PureComponent } from 'react';
import { rangeUtil } from '@grafana/data';
import { Switch, Input, InlineFormLabel, stylesFactory } from '@grafana/ui';
import { QueryOperationRow } from 'app/core/components/QueryOperationRow/QueryOperationRow';
import { config } from 'app/core/config';
export class QueryGroupOptionsEditor extends PureComponent {
    constructor(props) {
        var _a, _b, _c, _d;
        super(props);
        this.onRelativeTimeChange = (event) => {
            this.setState({
                timeRangeFrom: event.target.value,
            });
        };
        this.onTimeShiftChange = (event) => {
            this.setState({
                timeRangeShift: event.target.value,
            });
        };
        this.onOverrideTime = (event) => {
            var _a, _b;
            const { options, onChange } = this.props;
            const newValue = emptyToNull(event.target.value);
            const isValid = timeRangeValidation(newValue);
            if (isValid && ((_a = options.timeRange) === null || _a === void 0 ? void 0 : _a.from) !== newValue) {
                onChange(Object.assign(Object.assign({}, options), { timeRange: Object.assign(Object.assign({}, ((_b = options.timeRange) !== null && _b !== void 0 ? _b : {})), { from: newValue }) }));
            }
            this.setState({ relativeTimeIsValid: isValid });
        };
        this.onTimeShift = (event) => {
            var _a, _b;
            const { options, onChange } = this.props;
            const newValue = emptyToNull(event.target.value);
            const isValid = timeRangeValidation(newValue);
            if (isValid && ((_a = options.timeRange) === null || _a === void 0 ? void 0 : _a.shift) !== newValue) {
                onChange(Object.assign(Object.assign({}, options), { timeRange: Object.assign(Object.assign({}, ((_b = options.timeRange) !== null && _b !== void 0 ? _b : {})), { shift: newValue }) }));
            }
            this.setState({ timeShiftIsValid: isValid });
        };
        this.onToggleTimeOverride = () => {
            const { onChange, options } = this.props;
            this.setState({ timeRangeHide: !this.state.timeRangeHide }, () => {
                var _a;
                onChange(Object.assign(Object.assign({}, options), { timeRange: Object.assign(Object.assign({}, ((_a = options.timeRange) !== null && _a !== void 0 ? _a : {})), { hide: this.state.timeRangeHide }) }));
            });
        };
        this.onCacheTimeoutBlur = (event) => {
            const { options, onChange } = this.props;
            onChange(Object.assign(Object.assign({}, options), { cacheTimeout: emptyToNull(event.target.value) }));
        };
        this.onQueryCachingTTLBlur = (event) => {
            const { options, onChange } = this.props;
            let ttl = parseInt(event.target.value, 10);
            if (isNaN(ttl) || ttl === 0) {
                ttl = null;
            }
            onChange(Object.assign(Object.assign({}, options), { queryCachingTTL: ttl }));
        };
        this.onMaxDataPointsBlur = (event) => {
            const { options, onChange } = this.props;
            let maxDataPoints = parseInt(event.currentTarget.value, 10);
            if (isNaN(maxDataPoints) || maxDataPoints === 0) {
                maxDataPoints = null;
            }
            if (maxDataPoints !== options.maxDataPoints) {
                onChange(Object.assign(Object.assign({}, options), { maxDataPoints }));
            }
        };
        this.onMinIntervalBlur = (event) => {
            const { options, onChange } = this.props;
            const minInterval = emptyToNull(event.target.value);
            if (minInterval !== options.minInterval) {
                onChange(Object.assign(Object.assign({}, options), { minInterval }));
            }
        };
        this.onOpenOptions = () => {
            this.setState({ isOpen: true });
        };
        this.onCloseOptions = () => {
            this.setState({ isOpen: false });
        };
        const { options } = props;
        this.state = {
            timeRangeFrom: ((_a = options.timeRange) === null || _a === void 0 ? void 0 : _a.from) || '',
            timeRangeShift: ((_b = options.timeRange) === null || _b === void 0 ? void 0 : _b.shift) || '',
            timeRangeHide: (_d = (_c = options.timeRange) === null || _c === void 0 ? void 0 : _c.hide) !== null && _d !== void 0 ? _d : false,
            isOpen: false,
            relativeTimeIsValid: true,
            timeShiftIsValid: true,
        };
    }
    renderCacheTimeoutOption() {
        var _a, _b;
        const { dataSource, options } = this.props;
        const tooltip = `If your time series store has a query cache this option can override the default cache timeout. Specify a
    numeric value in seconds.`;
        if (!((_a = dataSource.meta.queryOptions) === null || _a === void 0 ? void 0 : _a.cacheTimeout)) {
            return null;
        }
        return (React.createElement("div", { className: "gf-form-inline" },
            React.createElement("div", { className: "gf-form" },
                React.createElement(InlineFormLabel, { width: 9, tooltip: tooltip }, "Cache timeout"),
                React.createElement(Input, { type: "text", className: "width-6", placeholder: "60", spellCheck: false, onBlur: this.onCacheTimeoutBlur, defaultValue: (_b = options.cacheTimeout) !== null && _b !== void 0 ? _b : '' }))));
    }
    renderQueryCachingTTLOption() {
        var _a, _b;
        const { dataSource, options } = this.props;
        const tooltip = `Cache time-to-live: How long results from this queries in this panel will be cached, in milliseconds. Defaults to the TTL in the caching configuration for this datasource.`;
        if (!((_a = dataSource.cachingConfig) === null || _a === void 0 ? void 0 : _a.enabled)) {
            return null;
        }
        return (React.createElement("div", { className: "gf-form-inline" },
            React.createElement("div", { className: "gf-form" },
                React.createElement(InlineFormLabel, { width: 9, tooltip: tooltip }, "Cache TTL"),
                React.createElement(Input, { type: "number", className: "width-6", placeholder: `${dataSource.cachingConfig.TTLMs}`, spellCheck: false, onBlur: this.onQueryCachingTTLBlur, defaultValue: (_b = options.queryCachingTTL) !== null && _b !== void 0 ? _b : undefined }))));
    }
    renderMaxDataPointsOption() {
        var _a, _b;
        const { data, options } = this.props;
        const realMd = (_a = data.request) === null || _a === void 0 ? void 0 : _a.maxDataPoints;
        const value = (_b = options.maxDataPoints) !== null && _b !== void 0 ? _b : '';
        const isAuto = value === '';
        return (React.createElement("div", { className: "gf-form-inline" },
            React.createElement("div", { className: "gf-form" },
                React.createElement(InlineFormLabel, { width: 9, tooltip: React.createElement(React.Fragment, null, "The maximum data points per series. Used directly by some data sources and used in calculation of auto interval. With streaming data this value is used for the rolling buffer.") }, "Max data points"),
                React.createElement(Input, { type: "number", className: "width-6", placeholder: `${realMd}`, spellCheck: false, onBlur: this.onMaxDataPointsBlur, defaultValue: value }),
                isAuto && (React.createElement(React.Fragment, null,
                    React.createElement("div", { className: "gf-form-label query-segment-operator" }, "="),
                    React.createElement("div", { className: "gf-form-label" }, "Width of panel"))))));
    }
    renderIntervalOption() {
        var _a, _b, _c;
        const { data, dataSource, options } = this.props;
        const realInterval = (_a = data.request) === null || _a === void 0 ? void 0 : _a.interval;
        const minIntervalOnDs = (_b = dataSource.interval) !== null && _b !== void 0 ? _b : 'No limit';
        return (React.createElement(React.Fragment, null,
            React.createElement("div", { className: "gf-form-inline" },
                React.createElement("div", { className: "gf-form" },
                    React.createElement(InlineFormLabel, { width: 9, tooltip: React.createElement(React.Fragment, null,
                            "A lower limit for the interval. Recommended to be set to write frequency, for example ",
                            React.createElement("code", null, "1m"),
                            ' ',
                            "if your data is written every minute. Default value can be set in data source settings for most data sources.") }, "Min interval"),
                    React.createElement(Input, { type: "text", className: "width-6", placeholder: `${minIntervalOnDs}`, spellCheck: false, onBlur: this.onMinIntervalBlur, defaultValue: (_c = options.minInterval) !== null && _c !== void 0 ? _c : '' }))),
            React.createElement("div", { className: "gf-form-inline" },
                React.createElement("div", { className: "gf-form" },
                    React.createElement(InlineFormLabel, { width: 9, tooltip: React.createElement(React.Fragment, null,
                            "The evaluated interval that is sent to data source and is used in ",
                            React.createElement("code", null, "$__interval"),
                            " and",
                            ' ',
                            React.createElement("code", null, "$__interval_ms"),
                            ". This value is not exactly equal to",
                            ' ',
                            React.createElement("code", null, "Time range / max data points"),
                            ", it will approximate a series of magic number.") }, "Interval"),
                    React.createElement(InlineFormLabel, { width: 6 }, realInterval),
                    React.createElement("div", { className: "gf-form-label query-segment-operator" }, "="),
                    React.createElement("div", { className: "gf-form-label" }, "Time range / max data points")))));
    }
    renderCollapsedText(styles) {
        var _a;
        const { data, options } = this.props;
        const { isOpen } = this.state;
        if (isOpen) {
            return undefined;
        }
        let mdDesc = (_a = options.maxDataPoints) !== null && _a !== void 0 ? _a : '';
        if (mdDesc === '' && data.request) {
            mdDesc = `auto = ${data.request.maxDataPoints}`;
        }
        let intervalDesc = options.minInterval;
        if (data.request) {
            intervalDesc = `${data.request.interval}`;
        }
        return (React.createElement(React.Fragment, null,
            React.createElement("div", { className: styles.collapsedText },
                "MD = ",
                mdDesc),
            React.createElement("div", { className: styles.collapsedText },
                "Interval = ",
                intervalDesc)));
    }
    render() {
        const { timeRangeHide: hideTimeOverride, relativeTimeIsValid, timeShiftIsValid } = this.state;
        const { timeRangeFrom: relativeTime, timeRangeShift: timeShift, isOpen } = this.state;
        const styles = getStyles();
        return (React.createElement(QueryOperationRow, { id: "Query options", index: 0, title: "Query options", headerElement: this.renderCollapsedText(styles), isOpen: isOpen, onOpen: this.onOpenOptions, onClose: this.onCloseOptions },
            this.renderMaxDataPointsOption(),
            this.renderIntervalOption(),
            this.renderCacheTimeoutOption(),
            this.renderQueryCachingTTLOption(),
            React.createElement("div", { className: "gf-form" },
                React.createElement(InlineFormLabel, { width: 9, tooltip: React.createElement(React.Fragment, null,
                        "Overrides the relative time range for individual panels, which causes them to be different than what is selected in the dashboard time picker in the top-right corner of the dashboard. For example to configure the Last 5 minutes the Relative time should be ",
                        React.createElement("code", null, "now-5m"),
                        " and ",
                        React.createElement("code", null, "5m"),
                        ", or variables like ",
                        React.createElement("code", null, "$_relativeTime"),
                        ".") }, "Relative time"),
                React.createElement(Input, { type: "text", className: "width-6", placeholder: "1h", onChange: this.onRelativeTimeChange, onBlur: this.onOverrideTime, invalid: !relativeTimeIsValid, value: relativeTime })),
            React.createElement("div", { className: "gf-form" },
                React.createElement(InlineFormLabel, { width: 9, tooltip: React.createElement(React.Fragment, null,
                        "Overrides the time range for individual panels by shifting its start and end relative to the time picker. For example to configure the Last 1h the Time shift should be ",
                        React.createElement("code", null, "now-1h"),
                        " and",
                        ' ',
                        React.createElement("code", null, "1h"),
                        ", or variables like ",
                        React.createElement("code", null, "$_timeShift"),
                        ".") }, "Time shift"),
                React.createElement(Input, { type: "text", className: "width-6", placeholder: "1h", onChange: this.onTimeShiftChange, onBlur: this.onTimeShift, invalid: !timeShiftIsValid, value: timeShift })),
            (timeShift || relativeTime) && (React.createElement("div", { className: "gf-form-inline align-items-center" },
                React.createElement(InlineFormLabel, { width: 9 }, "Hide time info"),
                React.createElement(Switch, { value: hideTimeOverride, onChange: this.onToggleTimeOverride })))));
    }
}
const timeRangeValidation = (value) => {
    if (!value) {
        return true;
    }
    return rangeUtil.isValidTimeSpan(value);
};
const emptyToNull = (value) => {
    return value === '' ? null : value;
};
const getStyles = stylesFactory(() => {
    const { theme } = config;
    return {
        collapsedText: css `
      margin-left: ${theme.spacing.md};
      font-size: ${theme.typography.size.sm};
      color: ${theme.colors.textWeak};
    `,
    };
});
//# sourceMappingURL=QueryGroupOptions.js.map