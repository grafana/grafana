import { get, isEqual } from 'lodash';
import React, { useEffect, useState } from 'react';
import { useEffectOnce } from 'react-use';
import { Alert, Field, Select } from '@grafana/ui';
import { selectors } from '../../e2e/selectors';
import { migrateQuery } from '../../grafanaTemplateVariableFns';
import { AzureQueryType } from '../../types';
import useLastError from '../../utils/useLastError';
import ArgQueryEditor from '../ArgQueryEditor';
import LogsQueryEditor from '../LogsQueryEditor';
import { Space } from '../Space';
import GrafanaTemplateVariableFnInput from './GrafanaTemplateVariableFn';
const removeOption = { label: '-', value: '' };
const VariableEditor = (props) => {
    const { query, onChange, datasource } = props;
    const AZURE_QUERY_VARIABLE_TYPE_OPTIONS = [
        { label: 'Subscriptions', value: AzureQueryType.SubscriptionsQuery },
        { label: 'Resource Groups', value: AzureQueryType.ResourceGroupsQuery },
        { label: 'Namespaces', value: AzureQueryType.NamespacesQuery },
        { label: 'Regions', value: AzureQueryType.LocationsQuery },
        { label: 'Resource Names', value: AzureQueryType.ResourceNamesQuery },
        { label: 'Metric Names', value: AzureQueryType.MetricNamesQuery },
        { label: 'Workspaces', value: AzureQueryType.WorkspacesQuery },
        { label: 'Resource Graph', value: AzureQueryType.AzureResourceGraph },
        { label: 'Logs', value: AzureQueryType.LogAnalytics },
    ];
    if (typeof props.query === 'object' && props.query.queryType === AzureQueryType.GrafanaTemplateVariableFn) {
        // Add the option for the GrafanaTemplateVariableFn only if it's already in use
        AZURE_QUERY_VARIABLE_TYPE_OPTIONS.push({
            label: 'Grafana Query Function',
            value: AzureQueryType.GrafanaTemplateVariableFn,
        });
    }
    const [variableOptionGroup, setVariableOptionGroup] = useState({
        label: 'Template Variables',
        options: [],
    });
    const [requireSubscription, setRequireSubscription] = useState(false);
    const [hasResourceGroup, setHasResourceGroup] = useState(false);
    const [hasNamespace, setHasNamespace] = useState(false);
    const [hasRegion, setHasRegion] = useState(false);
    const [requireResourceGroup, setRequireResourceGroup] = useState(false);
    const [requireNamespace, setRequireNamespace] = useState(false);
    const [requireResource, setRequireResource] = useState(false);
    const [subscriptions, setSubscriptions] = useState([]);
    const [resourceGroups, setResourceGroups] = useState([]);
    const [namespaces, setNamespaces] = useState([]);
    const [resources, setResources] = useState([]);
    const [regions, setRegions] = useState([]);
    const [errorMessage, setError] = useLastError();
    const queryType = typeof query === 'string' ? '' : query.queryType;
    useEffect(() => {
        migrateQuery(query, { datasource: datasource }).then((migratedQuery) => {
            if (!isEqual(query, migratedQuery)) {
                onChange(migratedQuery);
            }
        });
    }, [query, datasource, onChange]);
    useEffect(() => {
        setRequireSubscription(false);
        setHasResourceGroup(false);
        setHasNamespace(false);
        setRequireResourceGroup(false);
        setRequireNamespace(false);
        setRequireResource(false);
        switch (queryType) {
            case AzureQueryType.ResourceGroupsQuery:
            case AzureQueryType.WorkspacesQuery:
                setRequireSubscription(true);
                break;
            case AzureQueryType.NamespacesQuery:
                setRequireSubscription(true);
                setHasResourceGroup(true);
                break;
            case AzureQueryType.ResourceNamesQuery:
                setRequireSubscription(true);
                setHasResourceGroup(true);
                setHasNamespace(true);
                setHasRegion(true);
                break;
            case AzureQueryType.MetricNamesQuery:
                setRequireSubscription(true);
                setRequireResourceGroup(true);
                setRequireNamespace(true);
                setRequireResource(true);
                break;
            case AzureQueryType.LocationsQuery:
                setRequireSubscription(true);
                break;
        }
    }, [queryType]);
    useEffect(() => {
        const options = [];
        datasource.getVariablesRaw().forEach((v) => {
            if (get(v, 'query.queryType') !== queryType) {
                options.push({ label: v.label || v.name, value: `$${v.name}` });
            }
        });
        setVariableOptionGroup({
            label: 'Template Variables',
            options,
        });
    }, [datasource, queryType]);
    useEffectOnce(() => {
        datasource.getSubscriptions().then((subs) => {
            setSubscriptions(subs.map((s) => ({ label: s.text, value: s.value })));
        });
    });
    const subscription = typeof query === 'object' && query.subscription;
    useEffect(() => {
        if (subscription) {
            datasource.getResourceGroups(subscription).then((rgs) => {
                setResourceGroups(rgs.map((s) => ({ label: s.text, value: s.value })));
            });
        }
    }, [datasource, subscription]);
    const resourceGroup = (typeof query === 'object' && query.resourceGroup) || '';
    useEffect(() => {
        if (subscription) {
            datasource.getMetricNamespaces(subscription, resourceGroup).then((rgs) => {
                setNamespaces(rgs.map((s) => ({ label: s.text, value: s.value })));
            });
        }
    }, [datasource, subscription, resourceGroup]);
    useEffect(() => {
        if (subscription) {
            datasource.azureMonitorDatasource.getLocations([subscription]).then((rgs) => {
                const regions = [];
                rgs.forEach((r) => regions.push({ label: r.displayName, value: r.name }));
                setRegions(regions);
            });
        }
    }, [datasource, subscription, resourceGroup]);
    const namespace = (typeof query === 'object' && query.namespace) || '';
    useEffect(() => {
        if (subscription) {
            datasource.getResourceNames(subscription, resourceGroup, namespace).then((rgs) => {
                setResources(rgs.map((s) => ({ label: s.text, value: s.value })));
            });
        }
    }, [datasource, subscription, resourceGroup, namespace]);
    if (typeof query === 'string') {
        // still migrating the query
        return null;
    }
    const onQueryTypeChange = (selectableValue) => {
        if (selectableValue.value) {
            onChange(Object.assign(Object.assign({}, query), { queryType: selectableValue.value, subscription: undefined, resourceGroup: undefined, namespace: undefined, resource: undefined }));
        }
    };
    const onChangeSubscription = (selectableValue) => {
        if (selectableValue.value) {
            onChange(Object.assign(Object.assign({}, query), { subscription: selectableValue.value, resourceGroup: undefined, namespace: undefined, resource: undefined }));
        }
    };
    const onChangeResourceGroup = (selectableValue) => {
        onChange(Object.assign(Object.assign({}, query), { resourceGroup: selectableValue.value, namespace: undefined, resource: undefined }));
    };
    const onChangeNamespace = (selectableValue) => {
        onChange(Object.assign(Object.assign({}, query), { namespace: selectableValue.value, resource: undefined }));
    };
    const onChangeRegion = (selectableValue) => {
        onChange(Object.assign(Object.assign({}, query), { region: selectableValue.value }));
    };
    const onChangeResource = (selectableValue) => {
        onChange(Object.assign(Object.assign({}, query), { resource: selectableValue.value }));
    };
    const onQueryChange = (queryChange) => {
        onChange(queryChange);
    };
    return (React.createElement(React.Fragment, null,
        React.createElement(Field, { label: "Query Type", "data-testid": selectors.components.variableEditor.queryType.input },
            React.createElement(Select, { "aria-label": "select query type", onChange: onQueryTypeChange, options: AZURE_QUERY_VARIABLE_TYPE_OPTIONS, width: 25, value: queryType })),
        query.queryType === AzureQueryType.LogAnalytics && (React.createElement(React.Fragment, null,
            React.createElement(LogsQueryEditor, { subscriptionId: query.subscription, query: query, datasource: datasource, onChange: onQueryChange, variableOptionGroup: variableOptionGroup, setError: setError, hideFormatAs: true }),
            errorMessage && (React.createElement(React.Fragment, null,
                React.createElement(Space, { v: 2 }),
                React.createElement(Alert, { severity: "error", title: "An error occurred while requesting metadata from Azure Monitor" }, errorMessage instanceof Error ? errorMessage.message : errorMessage))))),
        query.queryType === AzureQueryType.GrafanaTemplateVariableFn && (React.createElement(GrafanaTemplateVariableFnInput, { query: query, updateQuery: props.onChange, datasource: datasource })),
        requireSubscription && (React.createElement(Field, { label: "Subscription", "data-testid": selectors.components.variableEditor.subscription.input },
            React.createElement(Select, { "aria-label": "select subscription", onChange: onChangeSubscription, options: subscriptions.concat(variableOptionGroup), width: 25, value: query.subscription || null }))),
        (requireResourceGroup || hasResourceGroup) && (React.createElement(Field, { label: "Resource Group", "data-testid": selectors.components.variableEditor.resourceGroup.input },
            React.createElement(Select, { "aria-label": "select resource group", onChange: onChangeResourceGroup, options: requireResourceGroup
                    ? resourceGroups.concat(variableOptionGroup)
                    : resourceGroups.concat(variableOptionGroup, removeOption), width: 25, value: query.resourceGroup || null, placeholder: requireResourceGroup ? undefined : 'Optional' }))),
        (requireNamespace || hasNamespace) && (React.createElement(Field, { label: "Namespace", "data-testid": selectors.components.variableEditor.namespace.input },
            React.createElement(Select, { "aria-label": "select namespace", onChange: onChangeNamespace, options: requireNamespace
                    ? namespaces.concat(variableOptionGroup)
                    : namespaces.concat(variableOptionGroup, removeOption), width: 25, value: query.namespace || null, placeholder: requireNamespace ? undefined : 'Optional' }))),
        hasRegion && (React.createElement(Field, { label: "Region", "data-testid": selectors.components.variableEditor.region.input },
            React.createElement(Select, { "aria-label": "select region", onChange: onChangeRegion, options: regions.concat(variableOptionGroup), width: 25, value: query.region || null, placeholder: "Optional" }))),
        requireResource && (React.createElement(Field, { label: "Resource", "data-testid": selectors.components.variableEditor.resource.input },
            React.createElement(Select, { "aria-label": "select resource", onChange: onChangeResource, options: resources.concat(variableOptionGroup), width: 25, value: query.resource || null }))),
        query.queryType === AzureQueryType.AzureResourceGraph && (React.createElement(React.Fragment, null,
            React.createElement(ArgQueryEditor, { subscriptionId: datasource.azureLogAnalyticsDatasource.defaultSubscriptionId, query: query, datasource: datasource, onChange: onQueryChange, variableOptionGroup: variableOptionGroup, setError: setError }),
            errorMessage && (React.createElement(React.Fragment, null,
                React.createElement(Space, { v: 2 }),
                React.createElement(Alert, { severity: "error", title: "An error occurred while requesting metadata from Azure Monitor" }, errorMessage instanceof Error ? errorMessage.message : errorMessage)))))));
};
export default VariableEditor;
//# sourceMappingURL=VariableEditor.js.map