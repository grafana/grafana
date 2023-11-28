import { __awaiter } from "tslib";
import React from 'react';
import { config } from '@grafana/runtime';
import { InlineField } from '@grafana/ui';
import { useAccountOptions, useDimensionKeys, useMetrics, useNamespaces, useRegions } from '../../hooks';
import { migrateVariableQuery } from '../../migrations/variableQueryMigrations';
import { VariableQueryType } from '../../types';
import { ALL_ACCOUNTS_OPTION } from '../shared/Account';
import { Dimensions } from '../shared/Dimensions/Dimensions';
import { MultiFilter } from './MultiFilter';
import { VariableQueryField } from './VariableQueryField';
import { VariableTextField } from './VariableTextField';
const queryTypes = [
    { value: VariableQueryType.Regions, label: 'Regions' },
    { value: VariableQueryType.Namespaces, label: 'Namespaces' },
    { value: VariableQueryType.Metrics, label: 'Metrics' },
    { value: VariableQueryType.DimensionKeys, label: 'Dimension Keys' },
    { value: VariableQueryType.DimensionValues, label: 'Dimension Values' },
    { value: VariableQueryType.EBSVolumeIDs, label: 'EBS Volume IDs' },
    { value: VariableQueryType.EC2InstanceAttributes, label: 'EC2 Instance Attributes' },
    { value: VariableQueryType.ResourceArns, label: 'Resource ARNs' },
    { value: VariableQueryType.Statistics, label: 'Statistics' },
    { value: VariableQueryType.LogGroups, label: 'Log Groups' },
    ...(config.featureToggles.cloudWatchCrossAccountQuerying
        ? [{ value: VariableQueryType.Accounts, label: 'Accounts' }]
        : []),
];
export const VariableQueryEditor = ({ query, datasource, onChange }) => {
    var _a, _b, _c;
    const parsedQuery = migrateVariableQuery(query);
    const { region, namespace, metricName, dimensionKey, dimensionFilters } = parsedQuery;
    const [regions, regionIsLoading] = useRegions(datasource);
    const namespaces = useNamespaces(datasource);
    const metrics = useMetrics(datasource, { region, namespace });
    const dimensionKeys = useDimensionKeys(datasource, { region, namespace, metricName });
    const keysForDimensionFilter = useDimensionKeys(datasource, { region, namespace, metricName, dimensionFilters });
    const accountState = useAccountOptions(datasource.resources, query.region);
    const onRegionChange = (region) => __awaiter(void 0, void 0, void 0, function* () {
        const validatedQuery = yield sanitizeQuery(Object.assign(Object.assign({}, parsedQuery), { region, accountId: undefined }));
        onQueryChange(validatedQuery);
    });
    const onNamespaceChange = (namespace) => __awaiter(void 0, void 0, void 0, function* () {
        const validatedQuery = yield sanitizeQuery(Object.assign(Object.assign({}, parsedQuery), { namespace }));
        onQueryChange(validatedQuery);
    });
    const onQueryChange = (newQuery) => {
        onChange(Object.assign(Object.assign({}, newQuery), { refId: 'CloudWatchVariableQueryEditor-VariableQuery' }));
    };
    // Reset dimensionValue parameters if namespace or region change
    const sanitizeQuery = (query) => __awaiter(void 0, void 0, void 0, function* () {
        let { metricName, dimensionKey, dimensionFilters, namespace, region } = query;
        if (metricName) {
            yield datasource.resources.getMetrics({ namespace, region }).then((result) => {
                if (!result.find((metric) => metric.value === metricName)) {
                    metricName = '';
                }
            });
        }
        if (dimensionKey) {
            yield datasource.resources
                .getDimensionKeys({ namespace, region })
                .then((result) => {
                if (!result.find((key) => key.value === dimensionKey)) {
                    dimensionKey = '';
                    dimensionFilters = {};
                }
            });
        }
        return Object.assign(Object.assign({}, query), { metricName, dimensionKey, dimensionFilters });
    });
    const hasRegionField = [
        VariableQueryType.Metrics,
        VariableQueryType.DimensionKeys,
        VariableQueryType.DimensionValues,
        VariableQueryType.EBSVolumeIDs,
        VariableQueryType.EC2InstanceAttributes,
        VariableQueryType.ResourceArns,
        VariableQueryType.LogGroups,
        VariableQueryType.Accounts,
    ].includes(parsedQuery.queryType);
    const hasAccountIDField = [
        VariableQueryType.Metrics,
        VariableQueryType.DimensionKeys,
        VariableQueryType.DimensionValues,
        VariableQueryType.LogGroups,
    ].includes(parsedQuery.queryType);
    const hasNamespaceField = [
        VariableQueryType.Metrics,
        VariableQueryType.DimensionKeys,
        VariableQueryType.DimensionValues,
    ].includes(parsedQuery.queryType);
    return (React.createElement(React.Fragment, null,
        React.createElement(VariableQueryField, { value: parsedQuery.queryType, options: queryTypes, onChange: (value) => onQueryChange(Object.assign(Object.assign({}, parsedQuery), { queryType: value, accountId: undefined })), label: "Query type", inputId: `variable-query-type-${query.refId}` }),
        hasRegionField && (React.createElement(VariableQueryField, { value: region, options: regions, onChange: (value) => onRegionChange(value), label: "Region", isLoading: regionIsLoading, inputId: `variable-query-region-${query.refId}` })),
        hasAccountIDField &&
            accountState.value &&
            ((_a = accountState.value) === null || _a === void 0 ? void 0 : _a.length) > 0 &&
            config.featureToggles.cloudWatchCrossAccountQuerying && (React.createElement(VariableQueryField, { label: "Account", value: (_b = query.accountId) !== null && _b !== void 0 ? _b : null, onChange: (accountId) => onQueryChange(Object.assign(Object.assign({}, parsedQuery), { accountId })), options: [ALL_ACCOUNTS_OPTION, ...accountState === null || accountState === void 0 ? void 0 : accountState.value], allowCustomValue: false })),
        hasNamespaceField && (React.createElement(VariableQueryField, { value: namespace, options: namespaces, onChange: (value) => onNamespaceChange(value), label: "Namespace", inputId: `variable-query-namespace-${query.refId}`, allowCustomValue: true })),
        parsedQuery.queryType === VariableQueryType.DimensionValues && (React.createElement(React.Fragment, null,
            React.createElement(VariableQueryField, { value: metricName || null, options: metrics, onChange: (value) => onQueryChange(Object.assign(Object.assign({}, parsedQuery), { metricName: value })), label: "Metric", inputId: `variable-query-metric-${query.refId}`, allowCustomValue: true }),
            React.createElement(VariableQueryField, { value: dimensionKey || null, options: dimensionKeys, onChange: (value) => onQueryChange(Object.assign(Object.assign({}, parsedQuery), { dimensionKey: value })), label: "Dimension key", inputId: `variable-query-dimension-key-${query.refId}`, allowCustomValue: true }),
            React.createElement(InlineField, { label: "Dimensions", labelWidth: 20, shrink: true, tooltip: "Dimensions to filter the returned values on" },
                React.createElement(Dimensions, { metricStat: Object.assign(Object.assign({}, parsedQuery), { dimensions: parsedQuery.dimensionFilters }), onChange: (dimensions) => {
                        onChange(Object.assign(Object.assign({}, parsedQuery), { dimensionFilters: dimensions }));
                    }, dimensionKeys: keysForDimensionFilter, disableExpressions: true, datasource: datasource })))),
        parsedQuery.queryType === VariableQueryType.EBSVolumeIDs && (React.createElement(VariableTextField, { value: query.instanceID, placeholder: "i-XXXXXXXXXXXXXXXXX", onBlur: (value) => onQueryChange(Object.assign(Object.assign({}, parsedQuery), { instanceID: value })), label: "Instance ID" })),
        parsedQuery.queryType === VariableQueryType.EC2InstanceAttributes && (React.createElement(React.Fragment, null,
            React.createElement(VariableTextField, { value: parsedQuery.attributeName, onBlur: (value) => onQueryChange(Object.assign(Object.assign({}, parsedQuery), { attributeName: value })), label: "Attribute name", interactive: true, tooltip: React.createElement(React.Fragment, null,
                    'Attribute or tag to query on. Tags should be formatted "Tags.<name>". ',
                    React.createElement("a", { href: "https://grafana.com/docs/grafana/latest/datasources/aws-cloudwatch/template-queries-cloudwatch/#selecting-attributes", target: "_blank", rel: "noreferrer" }, "See the documentation for more details")) }),
            React.createElement(InlineField, { label: "Filters", labelWidth: 20, shrink: true, tooltip: React.createElement(React.Fragment, null,
                    React.createElement("a", { href: "https://grafana.com/docs/grafana/latest/datasources/aws-cloudwatch/template-queries-cloudwatch/#selecting-attributes", target: "_blank", rel: "noreferrer" }, "Pre-defined ec2:DescribeInstances filters/tags"),
                    ' and the values to filter on. Tags should be formatted tag:<name>.') },
                React.createElement(MultiFilter, { filters: parsedQuery.ec2Filters, onChange: (filters) => {
                        onChange(Object.assign(Object.assign({}, parsedQuery), { ec2Filters: filters }));
                    }, keyPlaceholder: "filter/tag" })))),
        parsedQuery.queryType === VariableQueryType.ResourceArns && (React.createElement(React.Fragment, null,
            React.createElement(VariableTextField, { value: parsedQuery.resourceType, onBlur: (value) => onQueryChange(Object.assign(Object.assign({}, parsedQuery), { resourceType: value })), label: "Resource type" }),
            React.createElement(InlineField, { label: "Tags", shrink: true, labelWidth: 20, tooltip: "Tags to filter the returned values on." },
                React.createElement(MultiFilter, { filters: parsedQuery.tags, onChange: (filters) => {
                        onChange(Object.assign(Object.assign({}, parsedQuery), { tags: filters }));
                    }, keyPlaceholder: "tag" })))),
        parsedQuery.queryType === VariableQueryType.LogGroups && (React.createElement(VariableTextField, { value: (_c = query.logGroupPrefix) !== null && _c !== void 0 ? _c : '', onBlur: (value) => onQueryChange(Object.assign(Object.assign({}, parsedQuery), { logGroupPrefix: value })), label: "Log group prefix" }))));
};
//# sourceMappingURL=VariableQueryEditor.js.map