import React, { useCallback, useEffect, useState } from 'react';
import { InlineField, InlineFieldRow, Input, Select, TextArea } from '@grafana/ui';
import { migrateVariableEditorBackToVariableSupport, migrateVariableQueryToEditor, } from '../migrations/variableMigration';
import { promQueryModeller } from '../querybuilder/PromQueryModeller';
import { MetricsLabelsSection } from '../querybuilder/components/MetricsLabelsSection';
import { PromVariableQueryType as QueryType, } from '../types';
export const variableOptions = [
    { label: 'Label names', value: QueryType.LabelNames },
    { label: 'Label values', value: QueryType.LabelValues },
    { label: 'Metrics', value: QueryType.MetricNames },
    { label: 'Query result', value: QueryType.VarQueryResult },
    { label: 'Series query', value: QueryType.SeriesQuery },
    { label: 'Classic query', value: QueryType.ClassicQuery },
];
const refId = 'PrometheusVariableQueryEditor-VariableQuery';
export const PromVariableQueryEditor = ({ onChange, query, datasource }) => {
    // to select the query type, i.e. label_names, label_values, etc.
    const [qryType, setQryType] = useState(undefined);
    // list of variables for each function
    const [label, setLabel] = useState('');
    const [labelNamesMatch, setLabelNamesMatch] = useState('');
    // metric is used for both label_values() and metric()
    // label_values() metric requires a whole/complete metric
    // metric() is expected to be a part of a metric string
    const [metric, setMetric] = useState('');
    // varQuery is a whole query, can include math/rates/etc
    const [varQuery, setVarQuery] = useState('');
    // seriesQuery is only a whole
    const [seriesQuery, setSeriesQuery] = useState('');
    // the original variable query implementation, e.g. label_value(metric, label_name)
    const [classicQuery, setClassicQuery] = useState('');
    // list of label names for label_values(), /api/v1/labels, contains the same results as label_names() function
    const [labelOptions, setLabelOptions] = useState([]);
    // label filters have been added as a filter for metrics in label values query type
    const [labelFilters, setLabelFilters] = useState([]);
    useEffect(() => {
        var _a, _b, _c, _d, _e, _f, _g, _h;
        if (!query) {
            return;
        }
        if (query.qryType === QueryType.ClassicQuery) {
            setQryType(query.qryType);
            setClassicQuery((_a = query.query) !== null && _a !== void 0 ? _a : '');
        }
        else {
            // 1. Changing from standard to custom variable editor changes the string attr from expr to query
            // 2. jsonnet grafana as code passes a variable as a string
            const variableQuery = variableMigration(query);
            setLabelNamesMatch((_b = variableQuery.match) !== null && _b !== void 0 ? _b : '');
            setQryType(variableQuery.qryType);
            setLabel((_c = variableQuery.label) !== null && _c !== void 0 ? _c : '');
            setMetric((_d = variableQuery.metric) !== null && _d !== void 0 ? _d : '');
            setLabelFilters((_e = variableQuery.labelFilters) !== null && _e !== void 0 ? _e : []);
            setVarQuery((_f = variableQuery.varQuery) !== null && _f !== void 0 ? _f : '');
            setSeriesQuery((_g = variableQuery.seriesQuery) !== null && _g !== void 0 ? _g : '');
            setClassicQuery((_h = variableQuery.classicQuery) !== null && _h !== void 0 ? _h : '');
        }
    }, [query]);
    // set the label names options for the label values var query
    useEffect(() => {
        if (qryType !== QueryType.LabelValues) {
            return;
        }
        const variables = datasource.getVariables().map((variable) => ({ label: variable, value: variable }));
        if (!metric) {
            // get all the labels
            datasource.getTagKeys({ filters: [] }).then((labelNames) => {
                const names = labelNames.map(({ text }) => ({ label: text, value: text }));
                setLabelOptions([...variables, ...names]);
            });
        }
        else {
            // fetch the labels filtered by the metric
            const labelToConsider = [{ label: '__name__', op: '=', value: metric }];
            const expr = promQueryModeller.renderLabels(labelToConsider);
            if (datasource.hasLabelsMatchAPISupport()) {
                datasource.languageProvider.fetchSeriesLabelsMatch(expr).then((labelsIndex) => {
                    const labelNames = Object.keys(labelsIndex);
                    const names = labelNames.map((value) => ({ label: value, value: value }));
                    setLabelOptions([...variables, ...names]);
                });
            }
            else {
                datasource.languageProvider.fetchSeriesLabels(expr).then((labelsIndex) => {
                    const labelNames = Object.keys(labelsIndex);
                    const names = labelNames.map((value) => ({ label: value, value: value }));
                    setLabelOptions([...variables, ...names]);
                });
            }
        }
    }, [datasource, qryType, metric]);
    const onChangeWithVariableString = (updateVar, updLabelFilters) => {
        const queryVar = {
            qryType,
            label,
            metric,
            match: labelNamesMatch,
            varQuery,
            seriesQuery,
            classicQuery,
            refId: 'PrometheusVariableQueryEditor-VariableQuery',
        };
        let updateLabelFilters = updLabelFilters ? { labelFilters: updLabelFilters } : { labelFilters: labelFilters };
        const updatedVar = Object.assign(Object.assign(Object.assign({}, queryVar), updateVar), updateLabelFilters);
        const queryString = migrateVariableEditorBackToVariableSupport(updatedVar);
        // setting query.query property allows for update of variable definition
        onChange({
            query: queryString,
            qryType: updatedVar.qryType,
            refId,
        });
    };
    /** Call onchange for label names query type change */
    const onQueryTypeChange = (newType) => {
        var _a;
        setQryType(newType.value);
        if (newType.value !== QueryType.SeriesQuery) {
            onChangeWithVariableString({ qryType: (_a = newType.value) !== null && _a !== void 0 ? _a : 0 });
        }
    };
    /** Call onchange for label select when query type is label values */
    const onLabelChange = (newLabel) => {
        const newLabelvalue = newLabel && newLabel.value ? newLabel.value : '';
        setLabel(newLabelvalue);
        if (qryType === QueryType.LabelValues && newLabelvalue) {
            onChangeWithVariableString({ label: newLabelvalue });
        }
    };
    /**
     * Call onChange for MetricsLabels component change for label values query type
     * if there is a label (required) and
     * if the labels or metric are updated.
     */
    const metricsLabelsChange = (update) => {
        var _a;
        setMetric(update.metric);
        setLabelFilters(update.labels);
        const updMetric = update.metric;
        const updLabelFilters = (_a = update.labels) !== null && _a !== void 0 ? _a : [];
        if (qryType === QueryType.LabelValues && label && (updMetric || updLabelFilters)) {
            onChangeWithVariableString({ qryType, metric: updMetric }, updLabelFilters);
        }
    };
    const onLabelNamesMatchChange = (regex) => {
        if (qryType === QueryType.LabelNames) {
            onChangeWithVariableString({ qryType, match: regex });
        }
    };
    /**
     * Call onchange for metric change if metrics names (regex) query type
     * Debounce this because to not call the API for every keystroke.
     */
    const onMetricChange = (value) => {
        if (qryType === QueryType.MetricNames && value) {
            onChangeWithVariableString({ metric: value });
        }
    };
    /**
     *  Do not call onchange for variable query result when query type is var query result
     *  because the query may not be finished typing and an error is returned
     *  for incorrectly formatted series. Call onchange for blur instead.
     */
    const onVarQueryChange = (e) => {
        setVarQuery(e.currentTarget.value);
    };
    /**
     *  Do not call onchange for seriesQuery when query type is series query
     *  because the series may not be finished typing and an error is returned
     *  for incorrectly formatted series. Call onchange for blur instead.
     */
    const onSeriesQueryChange = (e) => {
        setSeriesQuery(e.currentTarget.value);
    };
    const onClassicQueryChange = (e) => {
        setClassicQuery(e.currentTarget.value);
    };
    const promVisualQuery = useCallback(() => {
        return { metric: metric, labels: labelFilters, operations: [] };
    }, [metric, labelFilters]);
    return (React.createElement(React.Fragment, null,
        React.createElement(InlineFieldRow, null,
            React.createElement(InlineField, { label: "Query type", labelWidth: 20, tooltip: React.createElement("div", null, "The Prometheus data source plugin provides the following query types for template variables.") },
                React.createElement(Select, { placeholder: "Select query type", "aria-label": "Query type", onChange: onQueryTypeChange, value: qryType, options: variableOptions, width: 25 }))),
        qryType === QueryType.LabelValues && (React.createElement(React.Fragment, null,
            React.createElement(InlineFieldRow, null,
                React.createElement(InlineField, { label: "Label", labelWidth: 20, required: true, "aria-labelledby": "label-select", tooltip: React.createElement("div", null, "Returns a list of label values for the label name in all metrics unless the metric is specified.") },
                    React.createElement(Select, { "aria-label": "label-select", onChange: onLabelChange, value: label, options: labelOptions, width: 25, allowCustomValue: true, isClearable: true }))),
            React.createElement(MetricsLabelsSection, { query: promVisualQuery(), datasource: datasource, onChange: metricsLabelsChange, variableEditor: true }))),
        qryType === QueryType.LabelNames && (React.createElement(InlineFieldRow, null,
            React.createElement(InlineField, { label: "Metric regex", labelWidth: 20, "aria-labelledby": "Metric regex", tooltip: React.createElement("div", null, "Returns a list of label names, optionally filtering by specified metric regex.") },
                React.createElement(Input, { type: "text", "aria-label": "Metric regex", placeholder: "Metric regex", value: labelNamesMatch, onBlur: (event) => {
                        setLabelNamesMatch(event.currentTarget.value);
                        onLabelNamesMatchChange(event.currentTarget.value);
                    }, onChange: (e) => {
                        setLabelNamesMatch(e.currentTarget.value);
                    }, width: 25 })))),
        qryType === QueryType.MetricNames && (React.createElement(InlineFieldRow, null,
            React.createElement(InlineField, { label: "Metric regex", labelWidth: 20, "aria-labelledby": "Metric selector", tooltip: React.createElement("div", null, "Returns a list of metrics matching the specified metric regex.") },
                React.createElement(Input, { type: "text", "aria-label": "Metric selector", placeholder: "Metric regex", value: metric, onChange: (e) => {
                        setMetric(e.currentTarget.value);
                    }, onBlur: (e) => {
                        setMetric(e.currentTarget.value);
                        onMetricChange(e.currentTarget.value);
                    }, width: 25 })))),
        qryType === QueryType.VarQueryResult && (React.createElement(InlineFieldRow, null,
            React.createElement(InlineField, { label: "Query", labelWidth: 20, tooltip: React.createElement("div", null, "Returns a list of Prometheus query results for the query. This can include Prometheus functions, i.e. sum(go_goroutines).") },
                React.createElement(TextArea, { type: "text", "aria-label": "Prometheus Query", placeholder: "Prometheus Query", value: varQuery, onChange: onVarQueryChange, onBlur: () => {
                        if (qryType === QueryType.VarQueryResult && varQuery) {
                            onChangeWithVariableString({ qryType });
                        }
                    }, cols: 100 })))),
        qryType === QueryType.SeriesQuery && (React.createElement(InlineFieldRow, null,
            React.createElement(InlineField, { label: "Series Query", labelWidth: 20, tooltip: React.createElement("div", null, "Enter enter a metric with labels, only a metric or only labels, i.e. go_goroutines{instance=\"localhost:9090\"}, go_goroutines, or {instance=\"localhost:9090\"}. Returns a list of time series associated with the entered data.") },
                React.createElement(Input, { type: "text", "aria-label": "Series Query", placeholder: "Series Query", value: seriesQuery, onChange: onSeriesQueryChange, onBlur: () => {
                        if (qryType === QueryType.SeriesQuery && seriesQuery) {
                            onChangeWithVariableString({ qryType });
                        }
                    }, width: 100 })))),
        qryType === QueryType.ClassicQuery && (React.createElement(InlineFieldRow, null,
            React.createElement(InlineField, { label: "Classic Query", labelWidth: 20, tooltip: React.createElement("div", null, "The original implemetation of the Prometheus variable query editor. Enter a string with the correct query type and parameters as described in these docs. For example, label_values(label, metric).") },
                React.createElement(Input, { type: "text", "aria-label": "Classic Query", placeholder: "Classic Query", value: classicQuery, onChange: onClassicQueryChange, onBlur: () => {
                        if (qryType === QueryType.ClassicQuery && classicQuery) {
                            onChangeWithVariableString({ qryType });
                        }
                    }, width: 100 }))))));
};
export function variableMigration(query) {
    if (typeof query === 'string') {
        return migrateVariableQueryToEditor(query);
    }
    else if (query.query) {
        return migrateVariableQueryToEditor(query.query);
    }
    else {
        return query;
    }
}
//# sourceMappingURL=VariableQueryEditor.js.map