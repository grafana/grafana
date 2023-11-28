import React from 'react';
import { InlineLabel, Input, InlineFormLabel, InlineSwitch } from '@grafana/ui';
export function RateSection({ query, onChange, onRunQuery, tsdbVersion }) {
    var _a, _b, _c, _d, _e;
    return (React.createElement("div", { className: "gf-form-inline", "data-testid": testIds.section },
        React.createElement("div", { className: "gf-form" },
            React.createElement(InlineFormLabel, { className: "query-keyword", width: 8 }, "Rate"),
            React.createElement(InlineSwitch, { "data-testid": testIds.shouldComputeRate, value: (_a = query.shouldComputeRate) !== null && _a !== void 0 ? _a : false, onChange: () => {
                    var _a;
                    const shouldComputeRate = (_a = query.shouldComputeRate) !== null && _a !== void 0 ? _a : false;
                    onChange(Object.assign(Object.assign({}, query), { shouldComputeRate: !shouldComputeRate }));
                    onRunQuery();
                } })),
        query.shouldComputeRate && (React.createElement("div", { className: "gf-form" },
            React.createElement(InlineFormLabel, { className: "query-keyword", width: 'auto' }, "Counter"),
            React.createElement(InlineSwitch, { "data-testid": testIds.isCounter, value: (_b = query.isCounter) !== null && _b !== void 0 ? _b : false, onChange: () => {
                    var _a;
                    const isCounter = (_a = query.isCounter) !== null && _a !== void 0 ? _a : false;
                    onChange(Object.assign(Object.assign({}, query), { isCounter: !isCounter }));
                    onRunQuery();
                } }))),
        query.shouldComputeRate && query.isCounter && (React.createElement("div", { className: "gf-form" },
            React.createElement(InlineLabel, { width: 'auto', className: "query-keyword" }, "Counter max"),
            React.createElement(Input, { "data-testid": testIds.counterMax, placeholder: "max value", value: (_c = query.counterMax) !== null && _c !== void 0 ? _c : '', onChange: (e) => {
                    const value = e.currentTarget.value;
                    onChange(Object.assign(Object.assign({}, query), { counterMax: value }));
                }, onBlur: () => onRunQuery() }),
            React.createElement(InlineLabel, { width: 'auto', className: "query-keyword" }, "Reset value"),
            React.createElement(Input, { "data-testid": testIds.counterResetValue, placeholder: "reset value", value: (_d = query.counterResetValue) !== null && _d !== void 0 ? _d : '', onChange: (e) => {
                    const value = e.currentTarget.value;
                    onChange(Object.assign(Object.assign({}, query), { counterResetValue: value }));
                }, onBlur: () => onRunQuery() }))),
        tsdbVersion > 2 && (React.createElement("div", { className: "gf-form" },
            React.createElement(InlineFormLabel, { className: "query-keyword", width: 'auto' }, "Explicit tags"),
            React.createElement(InlineSwitch, { "data-testid": testIds.explicitTags, value: (_e = query.explicitTags) !== null && _e !== void 0 ? _e : false, onChange: () => {
                    var _a;
                    const explicitTags = (_a = query.explicitTags) !== null && _a !== void 0 ? _a : false;
                    onChange(Object.assign(Object.assign({}, query), { explicitTags: !explicitTags }));
                    onRunQuery();
                } }))),
        React.createElement("div", { className: "gf-form gf-form--grow" },
            React.createElement("div", { className: "gf-form-label gf-form-label--grow" }))));
}
export const testIds = {
    section: 'opentsdb-rate',
    shouldComputeRate: 'opentsdb-shouldComputeRate',
    isCounter: 'opentsdb-is-counter',
    counterMax: 'opentsdb-counter-max',
    counterResetValue: 'opentsdb-counter-reset-value',
    explicitTags: 'opentsdb-explicit-tags',
};
//# sourceMappingURL=RateSection.js.map