import { css } from '@emotion/css';
import React, { useEffect, useId, useState } from 'react';
import { getDefaultTimeRange } from '@grafana/data';
import { Alert, InlineField, InlineLabel, Input, QueryField, useStyles2 } from '@grafana/ui';
import { useNextId } from '../../hooks/useNextId';
import { useDispatch } from '../../hooks/useStatelessReducer';
import { isSupportedVersion, isTimeSeriesQuery, unsupportedVersionMessage } from '../../utils';
import { BucketAggregationsEditor } from './BucketAggregationsEditor';
import { ElasticsearchProvider } from './ElasticsearchQueryContext';
import { MetricAggregationsEditor } from './MetricAggregationsEditor';
import { metricAggregationConfig } from './MetricAggregationsEditor/utils';
import { QueryTypeSelector } from './QueryTypeSelector';
import { changeAliasPattern, changeQuery } from './state';
// a react hook that returns the elasticsearch database version,
// or `null`, while loading, or if it is not possible to determine the value.
function useElasticVersion(datasource) {
    const [version, setVersion] = useState(null);
    useEffect(() => {
        let canceled = false;
        datasource.getDatabaseVersion().then((version) => {
            if (!canceled) {
                setVersion(version);
            }
        }, (error) => {
            // we do nothing
            console.log(error);
        });
        return () => {
            canceled = true;
        };
    }, [datasource]);
    return version;
}
export const QueryEditor = ({ query, onChange, onRunQuery, datasource, range }) => {
    const elasticVersion = useElasticVersion(datasource);
    const showUnsupportedMessage = elasticVersion != null && !isSupportedVersion(elasticVersion);
    return (React.createElement(ElasticsearchProvider, { datasource: datasource, onChange: onChange, onRunQuery: onRunQuery, query: query, range: range || getDefaultTimeRange() },
        showUnsupportedMessage && React.createElement(Alert, { title: unsupportedVersionMessage }),
        React.createElement(QueryEditorForm, { value: query })));
};
const getStyles = (theme) => ({
    root: css `
    display: flex;
  `,
    queryItem: css `
    flex-grow: 1;
    margin: 0 ${theme.spacing(0.5)} ${theme.spacing(0.5)} 0;
  `,
});
export const ElasticSearchQueryField = ({ value, onChange }) => {
    const styles = useStyles2(getStyles);
    return (React.createElement("div", { className: styles.queryItem },
        React.createElement(QueryField, { query: value, onChange: onChange, placeholder: "Enter a lucene query", portalOrigin: "elasticsearch" })));
};
const QueryEditorForm = ({ value }) => {
    var _a;
    const dispatch = useDispatch();
    const nextId = useNextId();
    const inputId = useId();
    const styles = useStyles2(getStyles);
    const isTimeSeries = isTimeSeriesQuery(value);
    const showBucketAggregationsEditor = (_a = value.metrics) === null || _a === void 0 ? void 0 : _a.every((metric) => metricAggregationConfig[metric.type].impliedQueryType === 'metrics');
    return (React.createElement(React.Fragment, null,
        React.createElement("div", { className: styles.root },
            React.createElement(InlineLabel, { width: 17 }, "Query type"),
            React.createElement("div", { className: styles.queryItem },
                React.createElement(QueryTypeSelector, null))),
        React.createElement("div", { className: styles.root },
            React.createElement(InlineLabel, { width: 17 }, "Lucene Query"),
            React.createElement(ElasticSearchQueryField, { onChange: (query) => dispatch(changeQuery(query)), value: value === null || value === void 0 ? void 0 : value.query }),
            isTimeSeries && (React.createElement(InlineField, { label: "Alias", labelWidth: 15, tooltip: "Aliasing only works for timeseries queries (when the last group is 'Date Histogram'). For all other query types this field is ignored.", htmlFor: inputId },
                React.createElement(Input, { id: inputId, placeholder: "Alias Pattern", onBlur: (e) => dispatch(changeAliasPattern(e.currentTarget.value)), defaultValue: value.alias })))),
        React.createElement(MetricAggregationsEditor, { nextId: nextId }),
        showBucketAggregationsEditor && React.createElement(BucketAggregationsEditor, { nextId: nextId })));
};
//# sourceMappingURL=index.js.map