import { __assign } from "tslib";
import React from 'react';
import { InlineFieldRow, InlineField, Select, MultiSelect, Input } from '@grafana/ui';
export function USAQueryEditor(_a) {
    var query = _a.query, onChange = _a.onChange;
    return (React.createElement(React.Fragment, null,
        React.createElement(InlineFieldRow, null,
            React.createElement(InlineField, { labelWidth: 14, label: "Mode" },
                React.createElement(Select, { menuShouldPortal: true, options: usaQueryModes, onChange: function (v) {
                        onChange(__assign(__assign({}, query), { mode: v.value }));
                    }, width: 32, value: usaQueryModes.find(function (ep) { return ep.value === query.mode; }) })),
            React.createElement(InlineField, { label: "Period" },
                React.createElement(Input, { value: query.period, placeholder: '30m', onChange: function (v) {
                        onChange(__assign(__assign({}, query), { period: v.currentTarget.value }));
                    } }))),
        React.createElement(InlineFieldRow, null,
            React.createElement(InlineField, { labelWidth: 14, label: "Fields" },
                React.createElement(MultiSelect, { menuShouldPortal: true, options: fieldNames, onChange: function (vals) {
                        onChange(__assign(__assign({}, query), { fields: vals.map(function (v) { return v.value; }) }));
                    }, width: 32, placeholder: "all", value: query.fields })),
            React.createElement(InlineField, { label: "States", grow: true },
                React.createElement(MultiSelect, { menuShouldPortal: true, options: stateNames, onChange: function (vals) {
                        onChange(__assign(__assign({}, query), { states: vals.map(function (v) { return v.value; }) }));
                    }, placeholder: "all", value: query.states })))));
}
export var usaQueryModes = [
    'values-as-rows',
    'values-as-fields',
    'values-as-labeled-fields',
    'timeseries',
    'timeseries-wide',
].map(function (f) { return ({ label: f, value: f }); });
export var fieldNames = [
    'foo',
    'bar',
    'baz', // all short
].map(function (f) { return ({ label: f, value: f }); });
export var stateNames = [
    'AL',
    'AK',
    'AZ',
    'AR',
    'CA',
    'CO',
    'CT',
    'DE',
    'DC',
    'FL',
    'GA',
    'HI',
    'ID',
    'IL',
    'IN',
    'IA',
    'KS',
    'KY',
    'LA',
    'ME',
    'MT',
    'NE',
    'NV',
    'NH',
    'NJ',
    'NM',
    'NY',
    'NC',
    'ND',
    'OH',
    'OK',
    'OR',
    'MD',
    'MA',
    'MI',
    'MN',
    'MS',
    'MO',
    'PA',
    'RI',
    'SC',
    'SD',
    'TN',
    'TX',
    'UT',
    'VT',
    'VA',
    'WA',
    'WV',
    'WI',
    'WY',
].map(function (f) { return ({ label: f, value: f }); });
//# sourceMappingURL=USAQueryEditor.js.map