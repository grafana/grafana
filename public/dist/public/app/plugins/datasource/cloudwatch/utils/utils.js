import { MetricQueryType, MetricEditorMode } from '../types';
export const toOption = (value) => ({ label: value, value });
export const appendTemplateVariables = (datasource, values) => [
    ...values,
    { label: 'Template Variables', options: datasource.getVariables().map(toOption) },
];
export const filterMetricsQuery = (query) => {
    const { region, metricQueryType, metricEditorMode, expression, metricName, namespace, sqlExpression, statistic } = query;
    if (!region) {
        return false;
    }
    if (metricQueryType === MetricQueryType.Search && metricEditorMode === MetricEditorMode.Builder) {
        return !!namespace && !!metricName && !!statistic;
    }
    else if (metricQueryType === MetricQueryType.Search && metricEditorMode === MetricEditorMode.Code) {
        return !!expression;
    }
    else if (metricQueryType === MetricQueryType.Query) {
        // still TBD how to validate the visual query builder for SQL
        return !!sqlExpression;
    }
    return false;
};
//# sourceMappingURL=utils.js.map