import { __awaiter } from "tslib";
import { cx } from '@emotion/css';
import React, { useCallback } from 'react';
import { satisfies } from 'semver';
import { InlineSegmentGroup, SegmentAsync, useTheme2 } from '@grafana/ui';
import { useFields } from '../../../hooks/useFields';
import { useDispatch } from '../../../hooks/useStatelessReducer';
import { MetricPicker } from '../../MetricPicker';
import { useDatasource, useQuery } from '../ElasticsearchQueryContext';
import { segmentStyles } from '../styles';
import { SettingsEditor } from './SettingsEditor';
import { isMetricAggregationWithField, isMetricAggregationWithInlineScript, isMetricAggregationWithSettings, isPipelineAggregation, isPipelineAggregationWithMultipleBucketPaths, } from './aggregations';
import { changeMetricField, changeMetricType } from './state/actions';
import { getStyles } from './styles';
import { metricAggregationConfig } from './utils';
const toOption = (metric) => ({
    label: metricAggregationConfig[metric.type].label,
    value: metric.type,
});
// If a metric is a Pipeline Aggregation (https://www.elastic.co/guide/en/elasticsearch/reference/current/search-aggregations-pipeline.html)
// it doesn't make sense to show it in the type picker when there is no non-pipeline-aggregation previously selected
// as they work on the outputs produced from other aggregations rather than from documents or fields.
// This means we should filter them out from the type picker if there's no other "basic" aggregation before the current one.
const isBasicAggregation = (metric) => !metricAggregationConfig[metric.type].isPipelineAgg;
const getTypeOptions = (previousMetrics, esVersion) => {
    // we'll include Pipeline Aggregations only if at least one previous metric is a "Basic" one
    const includePipelineAggregations = previousMetrics.some(isBasicAggregation);
    return (Object.entries(metricAggregationConfig)
        .filter(([_, config]) => config.impliedQueryType === 'metrics')
        // Only showing metrics type supported by the version of ES.
        // if we cannot determine the version, we assume it is suitable.
        .filter(([_, { versionRange = '*' }]) => (esVersion != null ? satisfies(esVersion, versionRange) : true))
        // Filtering out Pipeline Aggregations if there's no basic metric selected before
        .filter(([_, config]) => includePipelineAggregations || !config.isPipelineAgg)
        .map(([key, { label }]) => ({
        label,
        value: key,
    })));
};
export const MetricEditor = ({ value }) => {
    const styles = getStyles(useTheme2(), !!value.hide);
    const datasource = useDatasource();
    const query = useQuery();
    const dispatch = useDispatch();
    const getFields = useFields(value.type);
    const getTypeOptionsAsync = (previousMetrics) => __awaiter(void 0, void 0, void 0, function* () {
        const dbVersion = yield datasource.getDatabaseVersion();
        return getTypeOptions(previousMetrics, dbVersion);
    });
    const loadOptions = useCallback(() => __awaiter(void 0, void 0, void 0, function* () {
        const remoteFields = yield getFields();
        // Metric aggregations that have inline script support don't require a field to be set.
        if (isMetricAggregationWithInlineScript(value)) {
            return [{ label: 'None' }, ...remoteFields];
        }
        return remoteFields;
    }), [getFields, value]);
    const previousMetrics = query.metrics.slice(0, query.metrics.findIndex((m) => m.id === value.id));
    return (React.createElement(React.Fragment, null,
        React.createElement(InlineSegmentGroup, null,
            React.createElement(SegmentAsync, { className: cx(styles.color, segmentStyles), loadOptions: () => getTypeOptionsAsync(previousMetrics), onChange: (e) => dispatch(changeMetricType({ id: value.id, type: e.value })), value: toOption(value) }),
            isMetricAggregationWithField(value) && !isPipelineAggregation(value) && (React.createElement(SegmentAsync, { className: cx(styles.color, segmentStyles), loadOptions: loadOptions, onChange: (e) => dispatch(changeMetricField({ id: value.id, field: e.value })), placeholder: "Select Field", value: value.field })),
            isPipelineAggregation(value) && !isPipelineAggregationWithMultipleBucketPaths(value) && (React.createElement(MetricPicker, { className: cx(styles.color, segmentStyles), onChange: (e) => { var _a; return dispatch(changeMetricField({ id: value.id, field: (_a = e.value) === null || _a === void 0 ? void 0 : _a.id })); }, options: previousMetrics, value: value.field }))),
        isMetricAggregationWithSettings(value) && React.createElement(SettingsEditor, { metric: value, previousMetrics: previousMetrics })));
};
//# sourceMappingURL=MetricEditor.js.map