import { get, isEqual } from 'lodash';
import React, { useEffect, useState } from 'react';
import { useEffectOnce } from 'react-use';

import { SelectableValue } from '@grafana/data';
import { Alert, InlineField, Select } from '@grafana/ui';

import DataSource from '../../datasource';
import { selectors } from '../../e2e/selectors';
import { migrateQuery } from '../../grafanaTemplateVariableFns';
import { AzureMonitorOption, AzureMonitorQuery, AzureQueryType } from '../../types';
import useLastError from '../../utils/useLastError';
import ArgQueryEditor from '../ArgQueryEditor';
import LogsQueryEditor from '../LogsQueryEditor';
import { Space } from '../Space';

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
  const [requireResource, setRequireResource] = useState(false);
  const [subscriptions, setSubscriptions] = useState<SelectableValue[]>([]);
  const [resourceGroups, setResourceGroups] = useState<SelectableValue[]>([]);
  const [namespaces, setNamespaces] = useState<SelectableValue[]>([]);
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
        const regions: SelectableValue[] = [];
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

  return (
    <>
      <InlineField
        label="Select query type"
        labelWidth={20}
        data-testid={selectors.components.variableEditor.queryType.input}
      >
        <Select
          aria-label="select query type"
          onChange={onQueryTypeChange}
          options={AZURE_QUERY_VARIABLE_TYPE_OPTIONS}
          width={25}
          value={queryType}
        />
      </InlineField>
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
        <InlineField
          label="Select subscription"
          labelWidth={20}
          data-testid={selectors.components.variableEditor.subscription.input}
        >
          <Select
            aria-label="select subscription"
            onChange={onChangeSubscription}
            options={subscriptions.concat(variableOptionGroup)}
            width={25}
            value={query.subscription || null}
          />
        </InlineField>
      )}
      {(requireResourceGroup || hasResourceGroup) && (
        <InlineField
          label="Select resource group"
          labelWidth={20}
          data-testid={selectors.components.variableEditor.resourceGroup.input}
        >
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
        </InlineField>
      )}
      {(requireNamespace || hasNamespace) && (
        <InlineField
          label="Select namespace"
          labelWidth={20}
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
        </InlineField>
      )}
      {hasRegion && (
        <InlineField
          label="Select region"
          labelWidth={20}
          data-testid={selectors.components.variableEditor.region.input}
        >
          <Select
            aria-label="select region"
            onChange={onChangeRegion}
            options={regions.concat(variableOptionGroup)}
            width={25}
            value={query.region || null}
            placeholder="Optional"
          />
        </InlineField>
      )}
      {requireResource && (
        <InlineField
          label="Select resource"
          labelWidth={20}
          data-testid={selectors.components.variableEditor.resource.input}
        >
          <Select
            aria-label="select resource"
            onChange={onChangeResource}
            options={resources.concat(variableOptionGroup)}
            width={25}
            value={query.resource || null}
          />
        </InlineField>
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
