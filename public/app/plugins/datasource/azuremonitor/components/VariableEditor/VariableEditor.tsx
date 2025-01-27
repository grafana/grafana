import { get, isEqual } from 'lodash';
import { useEffect, useState } from 'react';
import { useEffectOnce } from 'react-use';

import { SelectableValue } from '@grafana/data';
import { getTemplateSrv } from '@grafana/runtime';
import { Alert, Field, Select, Space } from '@grafana/ui';

import UrlBuilder from '../../azure_monitor/url_builder';
import DataSource from '../../datasource';
import { selectors } from '../../e2e/selectors';
import { migrateQuery } from '../../grafanaTemplateVariableFns';
import { AzureMonitorOption, AzureMonitorQuery, AzureQueryType } from '../../types';
import useLastError from '../../utils/useLastError';
import ArgQueryEditor from '../ArgQueryEditor';
import LogsQueryEditor from '../LogsQueryEditor';

import GrafanaTemplateVariableFnInput from './GrafanaTemplateVariableFn';

type Props = {
  query: AzureMonitorQuery | string;
  onChange: (query: AzureMonitorQuery) => void;
  datasource: DataSource;
};

const removeOption: SelectableValue = { label: '-', value: '' };

const VariableEditor = (props: Props) => {
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
    { label: 'Custom Namespaces', value: AzureQueryType.CustomNamespacesQuery },
    { label: 'Custom Metric Names', value: AzureQueryType.CustomMetricNamesQuery },
  ];
  if (typeof props.query === 'object' && props.query.queryType === AzureQueryType.GrafanaTemplateVariableFn) {
    // Add the option for the GrafanaTemplateVariableFn only if it's already in use
    AZURE_QUERY_VARIABLE_TYPE_OPTIONS.push({
      label: 'Grafana Query Function',
      value: AzureQueryType.GrafanaTemplateVariableFn,
    });
  }
  const [variableOptionGroup, setVariableOptionGroup] = useState<{ label: string; options: AzureMonitorOption[] }>({
    label: 'Template Variables',
    options: [],
  });
  const [requireSubscription, setRequireSubscription] = useState(false);
  const [hasResourceGroup, setHasResourceGroup] = useState(false);
  const [hasNamespace, setHasNamespace] = useState(false);
  const [hasRegion, setHasRegion] = useState(false);
  const [requireResourceGroup, setRequireResourceGroup] = useState(false);
  const [requireNamespace, setRequireNamespace] = useState(false);
  const [requireCustomNamespace, setRequireCustomNamespace] = useState(false);
  const [requireResource, setRequireResource] = useState(false);
  const [subscriptions, setSubscriptions] = useState<SelectableValue[]>([]);
  const [resourceGroups, setResourceGroups] = useState<SelectableValue[]>([]);
  const [namespaces, setNamespaces] = useState<SelectableValue[]>([]);
  const [customNamespaces, setCustomNamespaces] = useState<SelectableValue[]>([]);
  const [resources, setResources] = useState<SelectableValue[]>([]);
  const [regions, setRegions] = useState<SelectableValue[]>([]);
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
    setRequireCustomNamespace(false);
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
      case AzureQueryType.CustomNamespacesQuery:
        setRequireSubscription(true);
        setRequireResourceGroup(true);
        setRequireNamespace(true);
        setRequireResource(true);
        break;
      case AzureQueryType.CustomMetricNamesQuery:
        setRequireSubscription(true);
        setRequireResourceGroup(true);
        setRequireResource(true);
        setRequireNamespace(true);
        setRequireCustomNamespace(true);
        break;
    }
  }, [queryType]);

  useEffect(() => {
    const options: AzureMonitorOption[] = [];
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

  // Always retrieve subscriptions first as they're used in most template variable queries
  useEffectOnce(() => {
    datasource.getSubscriptions().then((subs) => {
      setSubscriptions(subs.map((s) => ({ label: s.text, value: s.value })));
    });
  });

  const subscription = typeof query === 'object' && query.subscription;
  // When subscription is set, retrieve resource groups
  useEffect(() => {
    if (subscription) {
      datasource.getResourceGroups(subscription).then((rgs) => {
        setResourceGroups(rgs.map((s) => ({ label: s.text, value: s.value })));
      });
    }
  }, [datasource, subscription]);

  const resourceGroup = (typeof query === 'object' && query.resourceGroup) || '';
  // When resource group is set, retrieve metric namespaces (aka resource types for a custom metric and custom metric namespace query)
  useEffect(() => {
    if (subscription && resourceGroup) {
      datasource.getMetricNamespaces(subscription, resourceGroup).then((rgs) => {
        setNamespaces(rgs.map((s) => ({ label: s.text, value: s.value })));
      });
    }
  }, [datasource, subscription, resourceGroup]);

  // When subscription is set also retrieve locations
  useEffect(() => {
    if (subscription) {
      datasource.azureMonitorDatasource.getLocations([subscription]).then((rgs) => {
        const regions: SelectableValue[] = [];
        rgs.forEach((r) => regions.push({ label: r.displayName, value: r.name }));
        setRegions(regions);
      });
    }
  }, [datasource, subscription, resourceGroup]);

  const namespace = (typeof query === 'object' && query.namespace) || '';
  // When subscription, resource group, and namespace are all set, retrieve resource names
  useEffect(() => {
    if (subscription && resourceGroup && namespace) {
      datasource.getResourceNames(subscription, resourceGroup, namespace).then((rgs) => {
        setResources(rgs.map((s) => ({ label: s.text, value: s.value })));
      });
    }
  }, [datasource, subscription, resourceGroup, namespace]);

  const resource = (typeof query === 'object' && query.resource) || '';
  // When subscription, resource group, namespace, and resource name are all set, retrieve custom metric namespaces
  useEffect(() => {
    if (subscription && resourceGroup && namespace && resource) {
      const resourceUri = UrlBuilder.buildResourceUri(getTemplateSrv(), {
        subscription,
        resourceGroup,
        metricNamespace: namespace,
        resourceName: resource,
      });
      datasource.getMetricNamespaces(subscription, resourceGroup, resourceUri, true).then((rgs) => {
        setCustomNamespaces(rgs.map((s) => ({ label: s.text, value: s.value })));
      });
    }
  }, [datasource, subscription, resourceGroup, namespace, resource]);

  if (typeof query === 'string') {
    // still migrating the query
    return null;
  }

  const onQueryTypeChange = (selectableValue: SelectableValue) => {
    if (selectableValue.value) {
      onChange({
        ...query,
        queryType: selectableValue.value,
        subscription: undefined,
        resourceGroup: undefined,
        namespace: undefined,
        resource: undefined,
      });
    }
  };

  const onChangeSubscription = (selectableValue: SelectableValue) => {
    if (selectableValue.value) {
      onChange({
        ...query,
        subscription: selectableValue.value,
        resourceGroup: undefined,
        namespace: undefined,
        resource: undefined,
      });
    }
  };

  const onChangeResourceGroup = (selectableValue: SelectableValue) => {
    onChange({
      ...query,
      resourceGroup: selectableValue.value,
      namespace: undefined,
      resource: undefined,
    });
  };

  const onChangeNamespace = (selectableValue: SelectableValue) => {
    onChange({
      ...query,
      namespace: selectableValue.value,
      resource: undefined,
    });
  };

  const onChangeRegion = (selectableValue: SelectableValue) => {
    onChange({
      ...query,
      region: selectableValue.value,
    });
  };

  const onChangeResource = (selectableValue: SelectableValue) => {
    onChange({
      ...query,
      resource: selectableValue.value,
    });
  };

  const onQueryChange = (queryChange: AzureMonitorQuery) => {
    onChange(queryChange);
  };

  const onChangeCustomNamespace = (selectableValue: SelectableValue) => {
    onChange({
      ...query,
      customNamespace: selectableValue.value,
    });
  };

  return (
    <>
      <Field label="Query Type" data-testid={selectors.components.variableEditor.queryType.input}>
        <Select
          aria-label="select query type"
          onChange={onQueryTypeChange}
          options={AZURE_QUERY_VARIABLE_TYPE_OPTIONS}
          width={25}
          value={queryType}
        />
      </Field>
      {query.queryType === AzureQueryType.LogAnalytics && (
        <>
          <LogsQueryEditor
            subscriptionId={query.subscription}
            query={query}
            datasource={datasource}
            onChange={onQueryChange}
            variableOptionGroup={variableOptionGroup}
            setError={setError}
            hideFormatAs={true}
            basicLogsEnabled={datasource.azureMonitorDatasource.basicLogsEnabled ?? false}
          />
          {errorMessage && (
            <>
              <Space v={2} />
              <Alert severity="error" title="An error occurred while requesting metadata from Azure Monitor">
                {errorMessage instanceof Error ? errorMessage.message : errorMessage}
              </Alert>
            </>
          )}
        </>
      )}
      {query.queryType === AzureQueryType.GrafanaTemplateVariableFn && (
        <GrafanaTemplateVariableFnInput query={query} updateQuery={props.onChange} datasource={datasource} />
      )}
      {requireSubscription && (
        <Field label="Subscription" data-testid={selectors.components.variableEditor.subscription.input}>
          <Select
            aria-label="select subscription"
            onChange={onChangeSubscription}
            options={subscriptions.concat(variableOptionGroup)}
            width={25}
            value={query.subscription || null}
          />
        </Field>
      )}
      {(requireResourceGroup || hasResourceGroup) && (
        <Field label="Resource Group" data-testid={selectors.components.variableEditor.resourceGroup.input}>
          <Select
            aria-label="select resource group"
            onChange={onChangeResourceGroup}
            options={
              requireResourceGroup
                ? resourceGroups.concat(variableOptionGroup)
                : resourceGroups.concat(variableOptionGroup, removeOption)
            }
            width={25}
            value={query.resourceGroup || null}
            placeholder={requireResourceGroup ? undefined : 'Optional'}
          />
        </Field>
      )}
      {(requireNamespace || hasNamespace) && (
        <Field
          label={
            queryType === AzureQueryType.CustomNamespacesQuery || queryType === AzureQueryType.CustomMetricNamesQuery
              ? 'Resource Type'
              : 'Namespace'
          }
          data-testid={selectors.components.variableEditor.namespace.input}
        >
          <Select
            aria-label="select namespace"
            onChange={onChangeNamespace}
            options={
              requireNamespace
                ? namespaces.concat(variableOptionGroup)
                : namespaces.concat(variableOptionGroup, removeOption)
            }
            width={25}
            value={query.namespace || null}
            placeholder={requireNamespace ? undefined : 'Optional'}
          />
        </Field>
      )}
      {hasRegion && (
        <Field label="Region" data-testid={selectors.components.variableEditor.region.input}>
          <Select
            aria-label="select region"
            onChange={onChangeRegion}
            options={regions.concat(variableOptionGroup)}
            width={25}
            value={query.region || null}
            placeholder="Optional"
          />
        </Field>
      )}
      {requireResource && (
        <Field label="Resource" data-testid={selectors.components.variableEditor.resource.input}>
          <Select
            aria-label="select resource"
            onChange={onChangeResource}
            options={resources.concat(variableOptionGroup)}
            width={25}
            value={query.resource || null}
          />
        </Field>
      )}
      {requireCustomNamespace && (
        <Field label={'Custom Namespace'} data-testid={selectors.components.variableEditor.customNamespace.input}>
          <Select
            aria-label="select custom namespace"
            onChange={onChangeCustomNamespace}
            options={
              requireCustomNamespace
                ? customNamespaces.concat(variableOptionGroup)
                : customNamespaces.concat(variableOptionGroup, removeOption)
            }
            width={25}
            value={query.customNamespace || null}
            placeholder={requireCustomNamespace ? undefined : 'Optional'}
          />
        </Field>
      )}
      {query.queryType === AzureQueryType.AzureResourceGraph && (
        <>
          <ArgQueryEditor
            subscriptionId={datasource.azureLogAnalyticsDatasource.defaultSubscriptionId}
            query={query}
            datasource={datasource}
            onChange={onQueryChange}
            variableOptionGroup={variableOptionGroup}
            setError={setError}
          />
          {errorMessage && (
            <>
              <Space v={2} />
              <Alert severity="error" title="An error occurred while requesting metadata from Azure Monitor">
                {errorMessage instanceof Error ? errorMessage.message : errorMessage}
              </Alert>
            </>
          )}
        </>
      )}
    </>
  );
};

export default VariableEditor;
