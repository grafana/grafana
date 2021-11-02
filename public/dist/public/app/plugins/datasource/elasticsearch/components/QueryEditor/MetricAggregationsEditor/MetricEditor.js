import { __awaiter, __generator, __read, __spreadArray } from "tslib";
import { InlineSegmentGroup, Segment, SegmentAsync, useTheme2 } from '@grafana/ui';
import { cx } from '@emotion/css';
import React, { useCallback } from 'react';
import { useDatasource, useQuery } from '../ElasticsearchQueryContext';
import { useDispatch } from '../../../hooks/useStatelessReducer';
import { getStyles } from './styles';
import { SettingsEditor } from './SettingsEditor';
import { metricAggregationConfig } from './utils';
import { changeMetricField, changeMetricType } from './state/actions';
import { MetricPicker } from '../../MetricPicker';
import { segmentStyles } from '../styles';
import { isMetricAggregationWithField, isMetricAggregationWithInlineScript, isMetricAggregationWithSettings, isPipelineAggregation, isPipelineAggregationWithMultipleBucketPaths, } from './aggregations';
import { useFields } from '../../../hooks/useFields';
import { satisfies } from 'semver';
var toOption = function (metric) { return ({
    label: metricAggregationConfig[metric.type].label,
    value: metric.type,
}); };
// If a metric is a Pipeline Aggregation (https://www.elastic.co/guide/en/elasticsearch/reference/current/search-aggregations-pipeline.html)
// it doesn't make sense to show it in the type picker when there is no non-pipeline-aggregation previously selected
// as they work on the outputs produced from other aggregations rather than from documents or fields.
// This means we should filter them out from the type picker if there's no other "basic" aggregation before the current one.
var isBasicAggregation = function (metric) { return !metricAggregationConfig[metric.type].isPipelineAgg; };
var getTypeOptions = function (previousMetrics, esVersion, xpack) {
    if (xpack === void 0) { xpack = false; }
    // we'll include Pipeline Aggregations only if at least one previous metric is a "Basic" one
    var includePipelineAggregations = previousMetrics.some(isBasicAggregation);
    return (Object.entries(metricAggregationConfig)
        // Only showing metrics type supported by the configured version of ES
        .filter(function (_a) {
        var _b = __read(_a, 2), _ = _b[0], _c = _b[1].versionRange, versionRange = _c === void 0 ? '*' : _c;
        return satisfies(esVersion, versionRange);
    })
        // Filtering out Pipeline Aggregations if there's no basic metric selected before
        .filter(function (_a) {
        var _b = __read(_a, 2), _ = _b[0], config = _b[1];
        return includePipelineAggregations || !config.isPipelineAgg;
    })
        // Filtering out X-Pack plugins if X-Pack is disabled
        .filter(function (_a) {
        var _b = __read(_a, 2), _ = _b[0], config = _b[1];
        return (config.xpack ? xpack : true);
    })
        .map(function (_a) {
        var _b = __read(_a, 2), key = _b[0], label = _b[1].label;
        return ({
            label: label,
            value: key,
        });
    }));
};
export var MetricEditor = function (_a) {
    var value = _a.value;
    var styles = getStyles(useTheme2(), !!value.hide);
    var datasource = useDatasource();
    var query = useQuery();
    var dispatch = useDispatch();
    var getFields = useFields(value.type);
    var loadOptions = useCallback(function () { return __awaiter(void 0, void 0, void 0, function () {
        var remoteFields;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, getFields()];
                case 1:
                    remoteFields = _a.sent();
                    // Metric aggregations that have inline script support don't require a field to be set.
                    if (isMetricAggregationWithInlineScript(value)) {
                        return [2 /*return*/, __spreadArray([{ label: 'None' }], __read(remoteFields), false)];
                    }
                    return [2 /*return*/, remoteFields];
            }
        });
    }); }, [getFields, value]);
    var previousMetrics = query.metrics.slice(0, query.metrics.findIndex(function (m) { return m.id === value.id; }));
    return (React.createElement(React.Fragment, null,
        React.createElement(InlineSegmentGroup, null,
            React.createElement(Segment, { className: cx(styles.color, segmentStyles), options: getTypeOptions(previousMetrics, datasource.esVersion, datasource.xpack), onChange: function (e) { return dispatch(changeMetricType({ id: value.id, type: e.value })); }, value: toOption(value) }),
            isMetricAggregationWithField(value) && !isPipelineAggregation(value) && (React.createElement(SegmentAsync, { className: cx(styles.color, segmentStyles), loadOptions: loadOptions, onChange: function (e) { return dispatch(changeMetricField({ id: value.id, field: e.value })); }, placeholder: "Select Field", value: value.field })),
            isPipelineAggregation(value) && !isPipelineAggregationWithMultipleBucketPaths(value) && (React.createElement(MetricPicker, { className: cx(styles.color, segmentStyles), onChange: function (e) { var _a; return dispatch(changeMetricField({ id: value.id, field: (_a = e.value) === null || _a === void 0 ? void 0 : _a.id })); }, options: previousMetrics, value: value.field }))),
        isMetricAggregationWithSettings(value) && React.createElement(SettingsEditor, { metric: value, previousMetrics: previousMetrics })));
};
//# sourceMappingURL=MetricEditor.js.map