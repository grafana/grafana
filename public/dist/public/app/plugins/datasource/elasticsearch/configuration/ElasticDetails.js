import { __assign } from "tslib";
import React from 'react';
import { EventsWithValidation, regexValidation, LegacyForms } from '@grafana/ui';
var Switch = LegacyForms.Switch, Select = LegacyForms.Select, Input = LegacyForms.Input, FormField = LegacyForms.FormField;
import { gte, lt } from 'semver';
var indexPatternTypes = [
    { label: 'No pattern', value: 'none' },
    { label: 'Hourly', value: 'Hourly', example: '[logstash-]YYYY.MM.DD.HH' },
    { label: 'Daily', value: 'Daily', example: '[logstash-]YYYY.MM.DD' },
    { label: 'Weekly', value: 'Weekly', example: '[logstash-]GGGG.WW' },
    { label: 'Monthly', value: 'Monthly', example: '[logstash-]YYYY.MM' },
    { label: 'Yearly', value: 'Yearly', example: '[logstash-]YYYY' },
];
var esVersions = [
    { label: '2.x', value: '2.0.0' },
    { label: '5.x', value: '5.0.0' },
    { label: '5.6+', value: '5.6.0' },
    { label: '6.0+', value: '6.0.0' },
    { label: '7.0+', value: '7.0.0' },
    { label: '7.7+', value: '7.7.0' },
    { label: '7.10+', value: '7.10.0' },
];
export var ElasticDetails = function (_a) {
    var _b;
    var _c;
    var value = _a.value, onChange = _a.onChange;
    return (React.createElement(React.Fragment, null,
        React.createElement("h3", { className: "page-heading" }, "Elasticsearch details"),
        React.createElement("div", { className: "gf-form-group" },
            React.createElement("div", { className: "gf-form-inline" },
                React.createElement("div", { className: "gf-form" },
                    React.createElement(FormField, { labelWidth: 10, inputWidth: 15, label: "Index name", value: value.database || '', onChange: changeHandler('database', value, onChange), placeholder: 'es-index-name', required: true })),
                React.createElement("div", { className: "gf-form" },
                    React.createElement(FormField, { labelWidth: 10, label: "Pattern", inputEl: React.createElement(Select, { menuShouldPortal: true, options: indexPatternTypes, onChange: intervalHandler(value, onChange), value: indexPatternTypes.find(function (pattern) {
                                return pattern.value === (value.jsonData.interval === undefined ? 'none' : value.jsonData.interval);
                            }) }) }))),
            React.createElement("div", { className: "gf-form max-width-25" },
                React.createElement(FormField, { labelWidth: 10, inputWidth: 15, label: "Time field name", value: value.jsonData.timeField || '', onChange: jsonDataChangeHandler('timeField', value, onChange), required: true })),
            React.createElement("div", { className: "gf-form" },
                React.createElement(FormField, { labelWidth: 10, label: "Version", inputEl: React.createElement(Select, { menuShouldPortal: true, options: esVersions, onChange: function (option) {
                            var maxConcurrentShardRequests = getMaxConcurrenShardRequestOrDefault(value.jsonData.maxConcurrentShardRequests, option.value);
                            onChange(__assign(__assign({}, value), { jsonData: __assign(__assign({}, value.jsonData), { esVersion: option.value, maxConcurrentShardRequests: maxConcurrentShardRequests }) }));
                        }, value: esVersions.find(function (version) { return version.value === value.jsonData.esVersion; }) }) })),
            gte(value.jsonData.esVersion, '5.6.0') && (React.createElement("div", { className: "gf-form max-width-30" },
                React.createElement(FormField, { "aria-label": 'Max concurrent Shard Requests input', labelWidth: 15, label: "Max concurrent Shard Requests", value: value.jsonData.maxConcurrentShardRequests || '', onChange: jsonDataChangeHandler('maxConcurrentShardRequests', value, onChange) }))),
            React.createElement("div", { className: "gf-form-inline" },
                React.createElement("div", { className: "gf-form" },
                    React.createElement(FormField, { labelWidth: 10, label: "Min time interval", inputEl: React.createElement(Input, { className: 'width-6', value: value.jsonData.timeInterval || '', onChange: jsonDataChangeHandler('timeInterval', value, onChange), placeholder: "10s", validationEvents: (_b = {},
                                _b[EventsWithValidation.onBlur] = [
                                    regexValidation(/^\d+(ms|[Mwdhmsy])$/, 'Value is not valid, you can use number with time unit specifier: y, M, w, d, h, m, s'),
                                ],
                                _b) }), tooltip: React.createElement(React.Fragment, null,
                            "A lower limit for the auto group by time interval. Recommended to be set to write frequency, for example ",
                            React.createElement("code", null, "1m"),
                            " if your data is written every minute.") }))),
            React.createElement("div", { className: "gf-form-inline" },
                React.createElement(Switch, { label: "X-Pack enabled", labelClass: "width-10", checked: value.jsonData.xpack || false, onChange: jsonDataSwitchChangeHandler('xpack', value, onChange) })),
            gte(value.jsonData.esVersion, '6.6.0') && value.jsonData.xpack && (React.createElement("div", { className: "gf-form-inline" },
                React.createElement(Switch, { label: "Include frozen indices", labelClass: "width-10", checked: (_c = value.jsonData.includeFrozen) !== null && _c !== void 0 ? _c : false, onChange: jsonDataSwitchChangeHandler('includeFrozen', value, onChange) }))))));
};
// TODO: Use change handlers from @grafana/data
var changeHandler = function (key, value, onChange) { return function (event) {
    var _a;
    onChange(__assign(__assign({}, value), (_a = {}, _a[key] = event.currentTarget.value, _a)));
}; };
// TODO: Use change handlers from @grafana/data
var jsonDataChangeHandler = function (key, value, onChange) { return function (event) {
    var _a;
    onChange(__assign(__assign({}, value), { jsonData: __assign(__assign({}, value.jsonData), (_a = {}, _a[key] = event.currentTarget.value, _a)) }));
}; };
var jsonDataSwitchChangeHandler = function (key, value, onChange) { return function (event) {
    var _a;
    onChange(__assign(__assign({}, value), { jsonData: __assign(__assign({}, value.jsonData), (_a = {}, _a[key] = event.currentTarget.checked, _a)) }));
}; };
var intervalHandler = function (value, onChange) { return function (option) {
    var _a;
    var database = value.database;
    // If option value is undefined it will send its label instead so we have to convert made up value to undefined here.
    var newInterval = option.value === 'none' ? undefined : option.value;
    if (!database || database.length === 0 || database.startsWith('[logstash-]')) {
        var newDatabase = '';
        if (newInterval !== undefined) {
            var pattern = indexPatternTypes.find(function (pattern) { return pattern.value === newInterval; });
            if (pattern) {
                newDatabase = (_a = pattern.example) !== null && _a !== void 0 ? _a : '';
            }
        }
        onChange(__assign(__assign({}, value), { database: newDatabase, jsonData: __assign(__assign({}, value.jsonData), { interval: newInterval }) }));
    }
    else {
        onChange(__assign(__assign({}, value), { jsonData: __assign(__assign({}, value.jsonData), { interval: newInterval }) }));
    }
}; };
function getMaxConcurrenShardRequestOrDefault(maxConcurrentShardRequests, version) {
    if (maxConcurrentShardRequests === 5 && lt(version, '7.0.0')) {
        return 256;
    }
    if (maxConcurrentShardRequests === 256 && gte(version, '7.0.0')) {
        return 5;
    }
    return maxConcurrentShardRequests || defaultMaxConcurrentShardRequests(version);
}
export function defaultMaxConcurrentShardRequests(version) {
    return gte(version, '7.0.0') ? 5 : 256;
}
//# sourceMappingURL=ElasticDetails.js.map