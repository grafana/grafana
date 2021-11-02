var _a;
import { __assign } from "tslib";
import { onUpdateDatasourceJsonDataOptionChecked, updateDatasourcePluginJsonDataOption, } from '@grafana/data';
import { EventsWithValidation, InlineFormLabel, LegacyForms, regexValidation } from '@grafana/ui';
import React from 'react';
import { ExemplarsSettings } from './ExemplarsSettings';
var Select = LegacyForms.Select, Input = LegacyForms.Input, FormField = LegacyForms.FormField, Switch = LegacyForms.Switch;
var httpOptions = [
    { value: 'POST', label: 'POST' },
    { value: 'GET', label: 'GET' },
];
export var PromSettings = function (props) {
    var _a;
    var options = props.options, onOptionsChange = props.onOptionsChange;
    // We are explicitly adding httpMethod so it is correctly displayed in dropdown. This way, it is more predictable for users.
    if (!options.jsonData.httpMethod) {
        options.jsonData.httpMethod = 'POST';
    }
    return (React.createElement(React.Fragment, null,
        React.createElement("div", { className: "gf-form-group" },
            React.createElement("div", { className: "gf-form-inline" },
                React.createElement("div", { className: "gf-form" },
                    React.createElement(FormField, { label: "Scrape interval", labelWidth: 13, inputEl: React.createElement(Input, { className: "width-6", value: options.jsonData.timeInterval, spellCheck: false, placeholder: "15s", onChange: onChangeHandler('timeInterval', options, onOptionsChange), validationEvents: promSettingsValidationEvents }), tooltip: "Set this to the typical scrape and evaluation interval configured in Prometheus. Defaults to 15s." }))),
            React.createElement("div", { className: "gf-form-inline" },
                React.createElement("div", { className: "gf-form" },
                    React.createElement(FormField, { label: "Query timeout", labelWidth: 13, inputEl: React.createElement(Input, { className: "width-6", value: options.jsonData.queryTimeout, onChange: onChangeHandler('queryTimeout', options, onOptionsChange), spellCheck: false, placeholder: "60s", validationEvents: promSettingsValidationEvents }), tooltip: "Set the Prometheus query timeout." }))),
            React.createElement("div", { className: "gf-form" },
                React.createElement(InlineFormLabel, { width: 13, tooltip: "You can use either POST or GET HTTP method to query your Prometheus data source. POST is the recommended method as it allows bigger queries. Change this to GET if you have a Prometheus version older than 2.1 or if POST requests are restricted in your network." }, "HTTP Method"),
                React.createElement(Select, { menuShouldPortal: true, options: httpOptions, value: httpOptions.find(function (o) { return o.value === options.jsonData.httpMethod; }), onChange: onChangeHandler('httpMethod', options, onOptionsChange), width: 7 }))),
        React.createElement("h3", { className: "page-heading" }, "Misc"),
        React.createElement("div", { className: "gf-form-group" },
            React.createElement("div", { className: "gf-form" },
                React.createElement(Switch, { checked: (_a = options.jsonData.disableMetricsLookup) !== null && _a !== void 0 ? _a : false, label: "Disable metrics lookup", labelClass: "width-14", onChange: onUpdateDatasourceJsonDataOptionChecked(props, 'disableMetricsLookup'), tooltip: "Checking this option will disable the metrics chooser and metric/label support in the query field's autocomplete. This helps if you have performance issues with bigger Prometheus instances." })),
            React.createElement("div", { className: "gf-form-inline" },
                React.createElement("div", { className: "gf-form max-width-30" },
                    React.createElement(FormField, { label: "Custom query parameters", labelWidth: 14, tooltip: "Add Custom parameters to all Prometheus or Thanos queries.", inputEl: React.createElement(Input, { className: "width-25", value: options.jsonData.customQueryParameters, onChange: onChangeHandler('customQueryParameters', options, onOptionsChange), spellCheck: false, placeholder: "Example: max_source_resolution=5m&timeout=10" }) })))),
        React.createElement(ExemplarsSettings, { options: options.jsonData.exemplarTraceIdDestinations, onChange: function (exemplarOptions) {
                return updateDatasourcePluginJsonDataOption({ onOptionsChange: onOptionsChange, options: options }, 'exemplarTraceIdDestinations', exemplarOptions);
            } })));
};
export var promSettingsValidationEvents = (_a = {},
    _a[EventsWithValidation.onBlur] = [
        regexValidation(/^$|^\d+(ms|[Mwdhmsy])$/, 'Value is not valid, you can use number with time unit specifier: y, M, w, d, h, m, s'),
    ],
    _a);
export var getValueFromEventItem = function (eventItem) {
    if (!eventItem) {
        return '';
    }
    if (eventItem.hasOwnProperty('currentTarget')) {
        return eventItem.currentTarget.value;
    }
    return eventItem.value;
};
var onChangeHandler = function (key, options, onOptionsChange) { return function (eventItem) {
    var _a;
    onOptionsChange(__assign(__assign({}, options), { jsonData: __assign(__assign({}, options.jsonData), (_a = {}, _a[key] = getValueFromEventItem(eventItem), _a)) }));
}; };
//# sourceMappingURL=PromSettings.js.map