import { __awaiter } from "tslib";
import React, { useEffect, useMemo } from 'react';
import { toOption } from '@grafana/data';
import { EditorField, EditorFieldGroup, EditorSwitch } from '@grafana/experimental';
import { Select } from '@grafana/ui';
import { useDimensionKeys, useMetrics, useNamespaces } from '../../../../hooks';
import { STATISTICS } from '../../../../language/cloudwatch-sql/language';
import { appendTemplateVariables } from '../../../../utils/utils';
import { getMetricNameFromExpression, getNamespaceFromExpression, getSchemaLabelKeys as getSchemaLabels, isUsingWithSchema, removeMetricName, setAggregation, setMetricName, setNamespace, setSchemaLabels, setWithSchema, stringArrayToDimensions, } from './utils';
const AGGREGATIONS = STATISTICS.map(toOption);
const SQLBuilderSelectRow = ({ datasource, query, onQueryChange }) => {
    var _a, _b;
    const sql = (_a = query.sql) !== null && _a !== void 0 ? _a : {};
    const aggregation = (_b = sql.select) === null || _b === void 0 ? void 0 : _b.name;
    useEffect(() => {
        if (!aggregation) {
            onQueryChange(setAggregation(query, STATISTICS[0]));
        }
    }, [aggregation, onQueryChange, query]);
    const metricName = getMetricNameFromExpression(sql.select);
    const namespace = getNamespaceFromExpression(sql.from);
    const schemaLabels = getSchemaLabels(sql.from);
    const withSchemaEnabled = isUsingWithSchema(sql.from);
    const namespaceOptions = useNamespaces(datasource);
    const metricOptions = useMetrics(datasource, { region: query.region, namespace });
    const existingFilters = useMemo(() => stringArrayToDimensions(schemaLabels !== null && schemaLabels !== void 0 ? schemaLabels : []), [schemaLabels]);
    const unusedDimensionKeys = useDimensionKeys(datasource, {
        region: query.region,
        namespace,
        metricName,
        dimensionFilters: existingFilters,
    });
    const dimensionKeys = useMemo(() => ((schemaLabels === null || schemaLabels === void 0 ? void 0 : schemaLabels.length) ? [...unusedDimensionKeys, ...schemaLabels.map(toOption)] : unusedDimensionKeys), [unusedDimensionKeys, schemaLabels]);
    const onNamespaceChange = (query) => __awaiter(void 0, void 0, void 0, function* () {
        const validatedQuery = yield validateMetricName(query);
        onQueryChange(validatedQuery);
    });
    const validateMetricName = (query) => __awaiter(void 0, void 0, void 0, function* () {
        let { region, sql, namespace } = query;
        yield datasource.resources.getMetrics({ namespace, region }).then((result) => {
            if (!result.some((metric) => metric.value === metricName)) {
                sql = removeMetricName(query).sql;
            }
        });
        return Object.assign(Object.assign({}, query), { sql });
    });
    return (React.createElement(React.Fragment, null,
        React.createElement(EditorFieldGroup, null,
            React.createElement(EditorField, { label: "Namespace", width: 16 },
                React.createElement(Select, { "aria-label": "Namespace", value: namespace ? toOption(namespace) : null, inputId: `${query.refId}-cloudwatch-sql-namespace`, options: namespaceOptions, allowCustomValue: true, onChange: ({ value }) => value && onNamespaceChange(setNamespace(query, value)) })),
            React.createElement(EditorField, { label: "With schema" },
                React.createElement(EditorSwitch, { id: `${query.refId}-cloudwatch-sql-withSchema`, value: withSchemaEnabled, onChange: (ev) => ev.target instanceof HTMLInputElement && onQueryChange(setWithSchema(query, ev.target.checked)) })),
            withSchemaEnabled && (React.createElement(EditorField, { label: "Schema labels", disabled: !namespace },
                React.createElement(Select, { id: `${query.refId}-cloudwatch-sql-schema-label-keys`, width: "auto", isMulti: true, value: schemaLabels ? schemaLabels.map(toOption) : null, options: dimensionKeys, allowCustomValue: true, onChange: (item) => item && onQueryChange(setSchemaLabels(query, item)) })))),
        React.createElement(EditorFieldGroup, null,
            React.createElement(EditorField, { label: "Metric name", width: 16 },
                React.createElement(Select, { "aria-label": "Metric name", value: metricName ? toOption(metricName) : null, options: metricOptions, allowCustomValue: true, onChange: ({ value }) => value && onQueryChange(setMetricName(query, value)) })),
            React.createElement(EditorField, { label: "Aggregation", width: 16 },
                React.createElement(Select, { "aria-label": "Aggregation", value: aggregation ? toOption(aggregation) : null, options: appendTemplateVariables(datasource, AGGREGATIONS), onChange: ({ value }) => value && onQueryChange(setAggregation(query, value)) })))));
};
export default SQLBuilderSelectRow;
//# sourceMappingURL=SQLBuilderSelectRow.js.map