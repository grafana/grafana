import { __assign } from "tslib";
import React from 'react';
import { InlineFormLabel, LegacyForms } from '@grafana/ui';
var Select = LegacyForms.Select, Input = LegacyForms.Input;
var tsdbVersions = [
    { label: '<=2.1', value: 1 },
    { label: '==2.2', value: 2 },
    { label: '==2.3', value: 3 },
];
var tsdbResolutions = [
    { label: 'second', value: 1 },
    { label: 'millisecond', value: 2 },
];
export var OpenTsdbDetails = function (props) {
    var _a, _b, _c;
    var onChange = props.onChange, value = props.value;
    return (React.createElement(React.Fragment, null,
        React.createElement("h5", null, "OpenTSDB settings"),
        React.createElement("div", { className: "gf-form" },
            React.createElement(InlineFormLabel, { width: 7 }, "Version"),
            React.createElement(Select, { menuShouldPortal: true, options: tsdbVersions, value: (_a = tsdbVersions.find(function (version) { return version.value === value.jsonData.tsdbVersion; })) !== null && _a !== void 0 ? _a : tsdbVersions[0], onChange: onSelectChangeHandler('tsdbVersion', value, onChange) })),
        React.createElement("div", { className: "gf-form" },
            React.createElement(InlineFormLabel, { width: 7 }, "Resolution"),
            React.createElement(Select, { menuShouldPortal: true, options: tsdbResolutions, value: (_b = tsdbResolutions.find(function (resolution) { return resolution.value === value.jsonData.tsdbResolution; })) !== null && _b !== void 0 ? _b : tsdbResolutions[0], onChange: onSelectChangeHandler('tsdbResolution', value, onChange) })),
        React.createElement("div", { className: "gf-form" },
            React.createElement(InlineFormLabel, { width: 7 }, "Lookup limit"),
            React.createElement(Input, { type: "number", value: (_c = value.jsonData.lookupLimit) !== null && _c !== void 0 ? _c : 1000, onChange: onInputChangeHandler('lookupLimit', value, onChange) }))));
};
var onSelectChangeHandler = function (key, value, onChange) { return function (newValue) {
    var _a;
    onChange(__assign(__assign({}, value), { jsonData: __assign(__assign({}, value.jsonData), (_a = {}, _a[key] = newValue.value, _a)) }));
}; };
var onInputChangeHandler = function (key, value, onChange) { return function (event) {
    var _a;
    onChange(__assign(__assign({}, value), { jsonData: __assign(__assign({}, value.jsonData), (_a = {}, _a[key] = event.currentTarget.value, _a)) }));
}; };
//# sourceMappingURL=OpenTsdbDetails.js.map