import { __awaiter } from "tslib";
import { css } from '@emotion/css';
import React, { useEffect, useState } from 'react';
import { textUtil } from '@grafana/data';
import { useStyles2 } from '@grafana/ui';
import { DownSample } from './DownSample';
import { FilterSection } from './FilterSection';
import { MetricSection } from './MetricSection';
import { RateSection } from './RateSection';
import { TagSection } from './TagSection';
export function OpenTsdbQueryEditor({ datasource, onRunQuery, onChange, query, range, queries, }) {
    const styles = useStyles2(getStyles);
    const [aggregators, setAggregators] = useState([
        'avg',
        'sum',
        'min',
        'max',
        'dev',
        'zimsum',
        'mimmin',
        'mimmax',
    ]);
    const fillPolicies = ['none', 'nan', 'null', 'zero'];
    const [filterTypes, setFilterTypes] = useState([
        'wildcard',
        'iliteral_or',
        'not_iliteral_or',
        'not_literal_or',
        'iwildcard',
        'literal_or',
        'regexp',
    ]);
    const tsdbVersion = datasource.tsdbVersion;
    if (!query.aggregator) {
        query.aggregator = 'sum';
    }
    if (!query.downsampleAggregator) {
        query.downsampleAggregator = 'avg';
    }
    if (!query.downsampleFillPolicy) {
        query.downsampleFillPolicy = 'none';
    }
    useEffect(() => {
        datasource.getAggregators().then((aggs) => {
            if (aggs.length !== 0) {
                setAggregators(aggs);
            }
        });
    }, [datasource]);
    useEffect(() => {
        datasource.getFilterTypes().then((newFilterTypes) => {
            if (newFilterTypes.length !== 0) {
                setFilterTypes(newFilterTypes);
            }
        });
    }, [datasource]);
    function suggestMetrics(value) {
        return __awaiter(this, void 0, void 0, function* () {
            return datasource.metricFindQuery(`metrics(${value})`).then(getTextValues);
        });
    }
    // previously called as an autocomplete on every input,
    // in this we call it once on init and filter in the MetricSection component
    function suggestTagValues(value) {
        return __awaiter(this, void 0, void 0, function* () {
            return datasource.metricFindQuery(`suggest_tagv(${value})`).then(getTextValues);
        });
    }
    function suggestTagKeys(query) {
        return __awaiter(this, void 0, void 0, function* () {
            return datasource.suggestTagKeys(query);
        });
    }
    function getTextValues(metrics) {
        return metrics.map((value) => {
            return {
                value: textUtil.escapeHtml(value.text),
                description: value.text,
            };
        });
    }
    return (React.createElement("div", { className: styles.container, "data-testid": testIds.editor },
        React.createElement("div", { className: styles.visualEditor },
            React.createElement(MetricSection, { query: query, onChange: onChange, onRunQuery: onRunQuery, suggestMetrics: suggestMetrics, aggregators: aggregators }),
            React.createElement(DownSample, { query: query, onChange: onChange, onRunQuery: onRunQuery, aggregators: aggregators, fillPolicies: fillPolicies, tsdbVersion: tsdbVersion }),
            tsdbVersion >= 2 && (React.createElement(FilterSection, { query: query, onChange: onChange, onRunQuery: onRunQuery, filterTypes: filterTypes, suggestTagValues: suggestTagValues, suggestTagKeys: suggestTagKeys })),
            React.createElement(TagSection, { query: query, onChange: onChange, onRunQuery: onRunQuery, suggestTagValues: suggestTagValues, suggestTagKeys: suggestTagKeys, tsdbVersion: tsdbVersion }),
            React.createElement(RateSection, { query: query, onChange: onChange, onRunQuery: onRunQuery, tsdbVersion: tsdbVersion }))));
}
function getStyles(theme) {
    return {
        container: css `
      display: flex;
    `,
        visualEditor: css `
      flex-grow: 1;
    `,
        toggleButton: css `
      margin-left: ${theme.spacing(0.5)};
    `,
    };
}
export const testIds = {
    editor: 'opentsdb-editor',
};
//# sourceMappingURL=OpenTsdbQueryEditor.js.map