import { get } from 'lodash';
import React, { useEffect, useState } from 'react';
import { useEffectOnce } from 'react-use';

import { SelectableValue } from '@grafana/data';
import { config } from '@grafana/runtime';
import { Alert, InlineField, Select } from '@grafana/ui';

import DataSource from '../../datasource';
import { migrateStringQueriesToObjectQueries } from '../../grafanaTemplateVariableFns';
import { AzureMonitorOption, AzureMonitorQuery, AzureQueryType } from '../../types';
import useLastError from '../../utils/useLastError';
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
    { label: 'Grafana Query Function', value: AzureQueryType.GrafanaTemplateVariableFn },
    { label: 'Logs', value: AzureQueryType.LogAnalytics },
  ];
  if (config.featureToggles.azTemplateVars) {
    AZURE_QUERY_VARIABLE_TYPE_OPTIONS.push({ label: 'Subscriptions', value: AzureQueryType.SubscriptionsQuery });
    AZURE_QUERY_VARIABLE_TYPE_OPTIONS.push({ label: 'Resource Groups', value: AzureQueryType.ResourceGroupsQuery });
    AZURE_QUERY_VARIABLE_TYPE_OPTIONS.push({ label: 'Namespaces', value: AzureQueryType.NamespacesQuery });
    AZURE_QUERY_VARIABLE_TYPE_OPTIONS.push({ label: 'Resource Names', value: AzureQueryType.ResourceNamesQuery });
    AZURE_QUERY_VARIABLE_TYPE_OPTIONS.push({ label: 'Metric Names', value: AzureQueryType.MetricNamesQuery });
    AZURE_QUERY_VARIABLE_TYPE_OPTIONS.push({ label: 'Workspaces', value: AzureQueryType.WorkspacesQuery });
  }
  const [variableOptionGroup, setVariableOptionGroup] = useState<{ label: string; options: AzureMonitorOption[] }>({
    label: 'Template Variables',
    options: [],
  });
  const [requireSubscription, setRequireSubscription] = useState(false);
  const [hasResourceGroup, setHasResourceGroup] = useState(false);
  const [hasNamespace, setHasNamespace] = useState(false);
  const [requireResourceGroup, setRequireResourceGroup] = useState(false);
  const [requireNamespace, setRequireNamespace] = useState(false);
  const [requireResource, setRequireResource] = useState(false);
  const [subscriptions, setSubscriptions] = useState<SelectableValue[]>([]);
  const [resourceGroups, setResourceGroups] = useState<SelectableValue[]>([]);
  const [namespaces, setNamespaces] = useState<SelectableValue[]>([]);
  const [resources, setResources] = useState<SelectableValue[]>([]);
  const [errorMessage, setError] = useLastError();
  const queryType = typeof query === 'string' ? '' : query.queryType;

  useEffect(() => {
    migrateStringQueriesToObjectQueries(query, { datasource: datasource }).then((migratedQuery) => {
      onChange(migratedQuery);
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
        break;
      case AzureQueryType.MetricNamesQuery:
        setRequireSubscription(true);
        setRequireResourceGroup(true);
        setRequireNamespace(true);
        setRequireResource(true);
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
      });
    }
  };

  const onChangeSubscription = (selectableValue: SelectableValue) => {
    if (selectableValue.value) {
      onChange({
        ...query,
        subscription: selectableValue.value,
      });
    }
  };

  const onChangeResourceGroup = (selectableValue: SelectableValue) => {
    onChange({
      ...query,
      resourceGroup: selectableValue.value,
    });
  };

  const onChangeNamespace = (selectableValue: SelectableValue) => {
    onChange({
      ...query,
      namespace: selectableValue.value,
    });
  };

  const onChangeResource = (selectableValue: SelectableValue) => {
    onChange({
      ...query,
      resource: selectableValue.value,
    });
  };

  const onLogsQueryChange = (queryChange: AzureMonitorQuery) => {
    onChange(queryChange);
  };

  return (
    <>
      <InlineField label="Select query type" labelWidth={20}>
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
            onChange={onLogsQueryChange}
            variableOptionGroup={variableOptionGroup}
            setError={setError}
            hideFormatAs={true}
          />
          {errorMessage && (
            <>
              <Space v={2} />
              <Alert severity="error" title="An error occurred while requesting metadata from Azure Monitor">
                {errorMessage}
              </Alert>
            </>
          )}
        </>
      )}
      {query.queryType === AzureQueryType.GrafanaTemplateVariableFn && (
        <GrafanaTemplateVariableFnInput query={query} updateQuery={props.onChange} datasource={datasource} />
      )}
      {requireSubscription && (
        <InlineField label="Select subscription" labelWidth={20}>
          <Select
            aria-label="select subscription"
            onChange={onChangeSubscription}
            options={subscriptions.concat(variableOptionGroup)}
            width={25}
            value={query.subscription}
          />
        </InlineField>
      )}
      {(requireResourceGroup || hasResourceGroup) && (
        <InlineField label="Select resource group" labelWidth={20}>
          <Select
            aria-label="select resource group"
            onChange={onChangeResourceGroup}
            options={
              requireResourceGroup
                ? resourceGroups.concat(variableOptionGroup)
                : resourceGroups.concat(variableOptionGroup, removeOption)
            }
            width={25}
            value={query.resourceGroup}
            placeholder={requireResourceGroup ? '' : 'Optional'}
          />
        </InlineField>
      )}
      {(requireNamespace || hasNamespace) && (
        <InlineField label="Select namespace" labelWidth={20}>
          <Select
            aria-label="select namespace"
            onChange={onChangeNamespace}
            options={
              requireNamespace
                ? namespaces.concat(variableOptionGroup)
                : namespaces.concat(variableOptionGroup, removeOption)
            }
            width={25}
            value={query.namespace}
            placeholder={requireNamespace ? '' : 'Optional'}
          />
        </InlineField>
      )}
      {requireResource && (
        <InlineField label="Select resource" labelWidth={20}>
          <Select
            aria-label="select resource"
            onChange={onChangeResource}
            options={resources.concat(variableOptionGroup)}
            width={25}
            value={query.resource}
          />
        </InlineField>
      )}
    </>
  );
};

export default VariableEditor;
