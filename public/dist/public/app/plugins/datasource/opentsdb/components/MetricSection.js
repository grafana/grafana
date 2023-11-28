import debounce from 'debounce-promise';
import React from 'react';
import { toOption } from '@grafana/data';
import { Select, Input, InlineFormLabel, AsyncSelect } from '@grafana/ui';
export function MetricSection({ query, onChange, onRunQuery, suggestMetrics, aggregators }) {
    var _a;
    const aggregatorOptions = aggregators.map((value) => toOption(value));
    const metricSearch = debounce((query) => suggestMetrics(query), 350);
    return (React.createElement("div", { className: "gf-form-inline", "data-testid": testIds.section },
        React.createElement("div", { className: "gf-form" },
            React.createElement(InlineFormLabel, { width: 8, className: "query-keyword" }, "Metric"),
            React.createElement(AsyncSelect, { width: 25, inputId: "opentsdb-metric-select", className: "gf-form-input", value: query.metric ? toOption(query.metric) : undefined, placeholder: "Metric name", allowCustomValue: true, loadOptions: metricSearch, defaultOptions: [], onChange: ({ value }) => {
                    if (value) {
                        onChange(Object.assign(Object.assign({}, query), { metric: value }));
                        onRunQuery();
                    }
                } })),
        React.createElement("div", { className: "gf-form" },
            React.createElement(InlineFormLabel, { width: 'auto', className: "query-keyword" }, "Aggregator"),
            React.createElement(Select, { inputId: "opentsdb-aggregator-select", className: "gf-form-input", value: query.aggregator ? toOption(query.aggregator) : undefined, options: aggregatorOptions, onChange: ({ value }) => {
                    if (value) {
                        onChange(Object.assign(Object.assign({}, query), { aggregator: value }));
                        onRunQuery();
                    }
                } })),
        React.createElement("div", { className: "gf-form max-width-20" },
            React.createElement(InlineFormLabel, { className: "query-keyword", width: 6, tooltip: React.createElement("div", null, "Use patterns like $tag_tagname to replace part of the alias for a tag value") }, "Alias"),
            React.createElement(Input, { "data-testid": testIds.alias, placeholder: "series alias", value: (_a = query.alias) !== null && _a !== void 0 ? _a : '', onChange: (e) => {
                    const value = e.currentTarget.value;
                    onChange(Object.assign(Object.assign({}, query), { alias: value }));
                }, onBlur: () => onRunQuery() })),
        React.createElement("div", { className: "gf-form gf-form--grow" },
            React.createElement("div", { className: "gf-form-label gf-form-label--grow" }))));
}
export const testIds = {
    section: 'opentsdb-metricsection',
    alias: 'metric-alias',
};
//# sourceMappingURL=MetricSection.js.map