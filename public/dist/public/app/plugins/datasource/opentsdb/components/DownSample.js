import React from 'react';
import { toOption } from '@grafana/data';
import { InlineLabel, Select, Input, InlineFormLabel, InlineSwitch } from '@grafana/ui';
import { paddingRightClass } from './styles';
export function DownSample({ query, onChange, onRunQuery, aggregators, fillPolicies, tsdbVersion }) {
    var _a, _b;
    const aggregatorOptions = aggregators.map((value) => toOption(value));
    const fillPolicyOptions = fillPolicies.map((value) => toOption(value));
    return (React.createElement("div", { className: "gf-form-inline", "data-testid": testIds.section },
        React.createElement("div", { className: "gf-form" },
            React.createElement(InlineFormLabel, { className: "query-keyword", width: 8, tooltip: React.createElement("div", null,
                    "Leave interval blank for auto or for example use ",
                    React.createElement("code", null, "1m")) }, "Down sample"),
            React.createElement(Input, { width: 25, className: paddingRightClass, "data-testid": testIds.interval, placeholder: "interval", value: (_a = query.downsampleInterval) !== null && _a !== void 0 ? _a : '', onChange: (e) => {
                    const value = e.currentTarget.value;
                    onChange(Object.assign(Object.assign({}, query), { downsampleInterval: value }));
                }, onBlur: () => onRunQuery() })),
        React.createElement("div", { className: "gf-form" },
            React.createElement(InlineFormLabel, { width: 'auto', className: "query-keyword" }, "Aggregator"),
            React.createElement(Select, { className: "gf-form-input", value: query.downsampleAggregator ? toOption(query.downsampleAggregator) : undefined, options: aggregatorOptions, onChange: ({ value }) => {
                    if (value) {
                        onChange(Object.assign(Object.assign({}, query), { downsampleAggregator: value }));
                        onRunQuery();
                    }
                } })),
        tsdbVersion >= 2 && (React.createElement("div", { className: "gf-form" },
            React.createElement(InlineLabel, { className: "width-6 query-keyword" }, "Fill"),
            React.createElement(Select, { inputId: "opentsdb-fillpolicy-select", value: query.downsampleFillPolicy ? toOption(query.downsampleFillPolicy) : undefined, options: fillPolicyOptions, onChange: ({ value }) => {
                    if (value) {
                        onChange(Object.assign(Object.assign({}, query), { downsampleFillPolicy: value }));
                        onRunQuery();
                    }
                } }))),
        React.createElement("div", { className: "gf-form" },
            React.createElement(InlineFormLabel, { className: "query-keyword" }, "Disable downsampling"),
            React.createElement(InlineSwitch, { value: (_b = query.disableDownsampling) !== null && _b !== void 0 ? _b : false, onChange: () => {
                    var _a;
                    const disableDownsampling = (_a = query.disableDownsampling) !== null && _a !== void 0 ? _a : false;
                    onChange(Object.assign(Object.assign({}, query), { disableDownsampling: !disableDownsampling }));
                    onRunQuery();
                } })),
        React.createElement("div", { className: "gf-form gf-form--grow" },
            React.createElement("div", { className: "gf-form-label gf-form-label--grow" }))));
}
export const testIds = {
    section: 'opentsdb-downsample',
    interval: 'downsample-interval',
};
//# sourceMappingURL=DownSample.js.map