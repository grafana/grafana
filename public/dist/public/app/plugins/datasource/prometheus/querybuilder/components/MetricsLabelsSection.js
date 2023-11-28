import { __awaiter } from "tslib";
import React, { useCallback } from 'react';
import { getMetadataString } from '../../language_provider';
import { truncateResult } from '../../language_utils';
import { promQueryModeller } from '../PromQueryModeller';
import { regexifyLabelValuesQueryString } from '../shared/parsingUtils';
import { LabelFilters } from './LabelFilters';
import { MetricSelect } from './MetricSelect';
export function MetricsLabelsSection({ datasource, query, onChange, onBlur, variableEditor, }) {
    // fixing the use of 'as' from refactoring
    // @ts-ignore
    const onChangeLabels = (labels) => {
        onChange(Object.assign(Object.assign({}, query), { labels }));
    };
    /**
     * Map metric metadata to SelectableValue for Select component and also adds defined template variables to the list.
     */
    const withTemplateVariableOptions = useCallback((optionsPromise) => __awaiter(this, void 0, void 0, function* () {
        const variables = datasource.getVariables();
        const options = yield optionsPromise;
        return [
            ...variables.map((value) => ({ label: value, value })),
            ...options.map((option) => ({
                label: option.value,
                value: option.value,
                title: option.description,
            })),
        ];
    }), [datasource]);
    /**
     * Function kicked off when user interacts with label in label filters.
     * Formats a promQL expression and passes that off to helper functions depending on API support
     * @param forLabel
     */
    const onGetLabelNames = (forLabel) => __awaiter(this, void 0, void 0, function* () {
        // If no metric we need to use a different method
        if (!query.metric) {
            yield datasource.languageProvider.fetchLabels();
            return datasource.languageProvider.getLabelKeys().map((k) => ({ value: k }));
        }
        const labelsToConsider = query.labels.filter((x) => x !== forLabel);
        labelsToConsider.push({ label: '__name__', op: '=', value: query.metric });
        const expr = promQueryModeller.renderLabels(labelsToConsider);
        let labelsIndex;
        if (datasource.hasLabelsMatchAPISupport()) {
            labelsIndex = yield datasource.languageProvider.fetchSeriesLabelsMatch(expr);
        }
        else {
            labelsIndex = yield datasource.languageProvider.fetchSeriesLabels(expr);
        }
        // filter out already used labels
        return Object.keys(labelsIndex)
            .filter((labelName) => !labelsToConsider.find((filter) => filter.label === labelName))
            .map((k) => ({ value: k }));
    });
    const getLabelValuesAutocompleteSuggestions = (queryString, labelName) => {
        const forLabel = {
            label: labelName !== null && labelName !== void 0 ? labelName : '__name__',
            op: '=~',
            value: regexifyLabelValuesQueryString(`.*${queryString}`),
        };
        const labelsToConsider = query.labels.filter((x) => x.label !== forLabel.label);
        labelsToConsider.push(forLabel);
        if (query.metric) {
            labelsToConsider.push({ label: '__name__', op: '=', value: query.metric });
        }
        const interpolatedLabelsToConsider = labelsToConsider.map((labelObject) => (Object.assign(Object.assign({}, labelObject), { label: datasource.interpolateString(labelObject.label), value: datasource.interpolateString(labelObject.value) })));
        const expr = promQueryModeller.renderLabels(interpolatedLabelsToConsider);
        let response;
        if (datasource.hasLabelsMatchAPISupport()) {
            response = getLabelValuesFromLabelValuesAPI(forLabel, expr);
        }
        else {
            response = getLabelValuesFromSeriesAPI(forLabel, expr);
        }
        return response.then((response) => {
            truncateResult(response);
            return response;
        });
    };
    /**
     * Helper function to fetch and format label value results from legacy API
     * @param forLabel
     * @param promQLExpression
     */
    const getLabelValuesFromSeriesAPI = (forLabel, promQLExpression) => {
        if (!forLabel.label) {
            return Promise.resolve([]);
        }
        const result = datasource.languageProvider.fetchSeries(promQLExpression);
        const forLabelInterpolated = datasource.interpolateString(forLabel.label);
        return result.then((result) => {
            // This query returns duplicate values, scrub them out
            const set = new Set();
            result.forEach((labelValue) => {
                const labelNameString = labelValue[forLabelInterpolated];
                set.add(labelNameString);
            });
            return Array.from(set).map((labelValues) => ({ label: labelValues, value: labelValues }));
        });
    };
    /**
     * Helper function to fetch label values from a promql string expression and a label
     * @param forLabel
     * @param promQLExpression
     */
    const getLabelValuesFromLabelValuesAPI = (forLabel, promQLExpression) => {
        if (!forLabel.label) {
            return Promise.resolve([]);
        }
        return datasource.languageProvider.fetchSeriesValuesWithMatch(forLabel.label, promQLExpression).then((response) => {
            return response.map((v) => ({
                value: v,
                label: v,
            }));
        });
    };
    /**
     * Function kicked off when users interact with the value of the label filters
     * Formats a promQL expression and passes that into helper functions depending on API support
     * @param forLabel
     */
    const onGetLabelValues = (forLabel) => __awaiter(this, void 0, void 0, function* () {
        if (!forLabel.label) {
            return [];
        }
        // If no metric is selected, we can get the raw list of labels
        if (!query.metric) {
            return (yield datasource.languageProvider.getLabelValues(forLabel.label)).map((v) => ({ value: v }));
        }
        const labelsToConsider = query.labels.filter((x) => x !== forLabel);
        labelsToConsider.push({ label: '__name__', op: '=', value: query.metric });
        const interpolatedLabelsToConsider = labelsToConsider.map((labelObject) => (Object.assign(Object.assign({}, labelObject), { label: datasource.interpolateString(labelObject.label), value: datasource.interpolateString(labelObject.value) })));
        const expr = promQueryModeller.renderLabels(interpolatedLabelsToConsider);
        if (datasource.hasLabelsMatchAPISupport()) {
            return getLabelValuesFromLabelValuesAPI(forLabel, expr);
        }
        else {
            return getLabelValuesFromSeriesAPI(forLabel, expr);
        }
    });
    const onGetMetrics = useCallback(() => {
        return withTemplateVariableOptions(getMetrics(datasource, query));
    }, [datasource, query, withTemplateVariableOptions]);
    return (React.createElement(React.Fragment, null,
        React.createElement(MetricSelect, { query: query, onChange: onChange, onGetMetrics: onGetMetrics, datasource: datasource, labelsFilters: query.labels, metricLookupDisabled: datasource.lookupsDisabled, onBlur: onBlur ? onBlur : () => { }, variableEditor: variableEditor }),
        React.createElement(LabelFilters, { debounceDuration: datasource.getDebounceTimeInMilliseconds(), getLabelValuesAutofillSuggestions: getLabelValuesAutocompleteSuggestions, labelsFilters: query.labels, onChange: onChangeLabels, onGetLabelNames: (forLabel) => withTemplateVariableOptions(onGetLabelNames(forLabel)), onGetLabelValues: (forLabel) => withTemplateVariableOptions(onGetLabelValues(forLabel)), variableEditor: variableEditor })));
}
/**
 * Returns list of metrics, either all or filtered by query param. It also adds description string to each metric if it
 * exists.
 * @param datasource
 * @param query
 */
function getMetrics(datasource, query) {
    var _a, _b;
    return __awaiter(this, void 0, void 0, function* () {
        // Makes sure we loaded the metadata for metrics. Usually this is done in the start() method of the provider but we
        // don't use it with the visual builder and there is no need to run all the start() setup anyway.
        if (!datasource.languageProvider.metricsMetadata) {
            yield datasource.languageProvider.loadMetricsMetadata();
        }
        // Error handling for when metrics metadata returns as undefined
        if (!datasource.languageProvider.metricsMetadata) {
            datasource.languageProvider.metricsMetadata = {};
        }
        let metrics;
        if (query.labels.length > 0) {
            const expr = promQueryModeller.renderLabels(query.labels);
            metrics = (_a = (yield datasource.languageProvider.getSeries(expr, true))['__name__']) !== null && _a !== void 0 ? _a : [];
        }
        else {
            metrics = (_b = (yield datasource.languageProvider.getLabelValues('__name__'))) !== null && _b !== void 0 ? _b : [];
        }
        return metrics.map((m) => ({
            value: m,
            description: getMetadataString(m, datasource.languageProvider.metricsMetadata),
        }));
    });
}
//# sourceMappingURL=MetricsLabelsSection.js.map