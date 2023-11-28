import React from 'react';
import { InlineFieldRow, InlineField, Select, MultiSelect, Input } from '@grafana/ui';
export function USAQueryEditor({ query, onChange }) {
    return (React.createElement(React.Fragment, null,
        React.createElement(InlineFieldRow, null,
            React.createElement(InlineField, { labelWidth: 14, label: "Mode" },
                React.createElement(Select, { options: usaQueryModes, onChange: (v) => {
                        onChange(Object.assign(Object.assign({}, query), { mode: v.value }));
                    }, width: 32, value: usaQueryModes.find((ep) => ep.value === query.mode) })),
            React.createElement(InlineField, { label: "Period" },
                React.createElement(Input, { value: query.period, placeholder: '30m', onChange: (v) => {
                        onChange(Object.assign(Object.assign({}, query), { period: v.currentTarget.value }));
                    } }))),
        React.createElement(InlineFieldRow, null,
            React.createElement(InlineField, { labelWidth: 14, label: "Fields" },
                React.createElement(MultiSelect, { options: fieldNames, onChange: (vals) => {
                        onChange(Object.assign(Object.assign({}, query), { fields: vals.map((v) => v.value) }));
                    }, width: 32, placeholder: "all", value: query.fields })),
            React.createElement(InlineField, { label: "States", grow: true },
                React.createElement(MultiSelect, { options: stateNames, onChange: (vals) => {
                        onChange(Object.assign(Object.assign({}, query), { states: vals.map((v) => v.value) }));
                    }, placeholder: "all", value: query.states })))));
}
export const usaQueryModes = [
    'values-as-rows',
    'values-as-fields',
    'values-as-labeled-fields',
    'timeseries',
    'timeseries-wide',
].map((f) => ({ label: f, value: f }));
export const fieldNames = [
    'foo',
    'bar',
    'baz', // all short
].map((f) => ({ label: f, value: f }));
export const stateNames = [
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
].map((f) => ({ label: f, value: f }));
//# sourceMappingURL=USAQueryEditor.js.map