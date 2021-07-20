import React, { useEffect, useState } from 'react';

import Datasource from '../../datasource';
import { AzureMonitorQuery, AzureMonitorOption, AzureMonitorErrorish } from '../../types';
import { useMetricsMetadata } from '../metrics';
import SubscriptionField from '../SubscriptionField';
import MetricNamespaceField from './MetricNamespaceField';
import ResourceTypeField from './ResourceTypeField';
import ResourceGroupsField from './ResourceGroupsField';
import ResourceNameField from './ResourceNameField';
import MetricNameField from './MetricNameField';
import AggregationField from './AggregationField';
import TimeGrainField from './TimeGrainField';
import DimensionFields from './DimensionFields';
import TopField from './TopField';
import LegendFormatField from './LegendFormatField';
import { InlineFieldRow } from '@grafana/ui';
import { findOption, toOption } from '../../utils/common';
import { setMetricNamespace } from './setQueryValue';

interface MetricsQueryEditorProps {
  query: AzureMonitorQuery;
  datasource: Datasource;
  subscriptionId?: string;
  onChange: (newQuery: AzureMonitorQuery) => void;
  variableOptionGroup: { label: string; options: AzureMonitorOption[] };
  setError: (source: string, error: AzureMonitorErrorish | undefined) => void;
}

function useAsyncState<T>(asyncFn: () => Promise<T>, setError: Function, dependencies: unknown[]) {
  const [errorSource] = useState(() => Math.random());
  const [value, setValue] = useState<T>();

  useEffect(() => {
    asyncFn()
      .then((results) => {
        setValue(results);
        setError(errorSource, undefined);
      })
      .catch((err) => setError(errorSource, err));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, dependencies);

  return value;
}

const MetricsQueryEditor: React.FC<MetricsQueryEditorProps> = ({
  query,
  datasource,
  subscriptionId,
  variableOptionGroup,
  onChange,
  setError,
}) => {
  const { resourceGroup, metricDefinition, resourceName, metricNamespace } = query.azureMonitor ?? {};

  const metricsMetadata = useMetricsMetadata(datasource, query, subscriptionId, onChange);

  const subscriptions = useAsyncState(
    async () => {
      console.log('* datasource.getSubscriptions effect running');
      const results = await datasource.azureMonitorDatasource.getSubscriptions();
      return results.map((v) => ({ label: v.text, value: v.value, description: v.value }));
    },
    setError,
    []
  );

  const resourceGroups = useAsyncState(
    async () => {
      if (!subscriptionId) {
        return;
      }

      console.log('* datasource.getResourceGroups effect running');
      const results = await datasource.getResourceGroups(subscriptionId);
      return results.map(toOption);
    },
    setError,
    [subscriptionId]
  );

  const resourceTypes = useAsyncState(
    async () => {
      if (!(subscriptionId && resourceGroup)) {
        return;
      }

      console.log('* datasource.getMetricDefinitions effect running');
      const results = await datasource.getMetricDefinitions(subscriptionId, resourceGroup);
      return results.map(toOption);
    },
    setError,
    [subscriptionId, resourceGroup]
  );

  const resourceNames = useAsyncState(
    async () => {
      if (!(subscriptionId && resourceGroup && metricDefinition)) {
        return;
      }

      console.log('* datasource.getResourceNames effect running');
      const results = await datasource.getResourceNames(subscriptionId, resourceGroup, metricDefinition);
      return results.map(toOption);
    },
    setError,
    [subscriptionId, resourceGroup, metricDefinition]
  );

  // TODO: Should set a default namespace when the results come back
  const metricNamespaces = useAsyncState(
    async () => {
      if (!(subscriptionId && resourceGroup && metricDefinition && resourceName)) {
        return;
      }

      console.log('* datasource.getMetricNamespaces effect running');
      const results = await datasource.getMetricNamespaces(
        subscriptionId,
        resourceGroup,
        metricDefinition,
        resourceName
      );

      // if (query.metricNamespace is not in results){
      //   onChange(setMetricNamespace(query, undefined));
      // }

      // if (metricNamespaces?.length === 1) {
      //   console.log('# metric namespace has only one option, so setting that');
      //   onChange(setMetricNamespace(query, metricNamespaces[0].value));
      // }

      return results.map(toOption);
    },
    setError,
    [subscriptionId, resourceGroup, metricDefinition, resourceName]
  );

  useEffect(() => {
    if (metricNamespace && !findOption(metricNamespaces ?? [], metricNamespace)) {
      console.log('# metric namespace does not exist within options, so clearing it');
      onChange(setMetricNamespace(query, undefined));
    }

    if (metricNamespaces?.length === 1) {
      console.log('# metric namespace has only one option, so setting that');
      onChange(setMetricNamespace(query, metricNamespaces[0].value));
    }
  }, [metricNamespaces, metricNamespace, onChange, query]);

  const metricNames = useAsyncState(
    async () => {
      if (!(subscriptionId && resourceGroup && metricDefinition && resourceName && metricNamespace)) {
        return;
      }

      console.log('* datasource.getMetricNames effect running');
      const results = await datasource.getMetricNames(
        subscriptionId,
        resourceGroup,
        metricDefinition,
        resourceName,
        metricNamespace
      );

      return results.map(toOption);
    },
    setError,
    [subscriptionId, resourceGroup, metricDefinition, resourceName, metricNamespace]
  );

  return (
    <div data-testid="azure-monitor-metrics-query-editor">
      <InlineFieldRow>
        <SubscriptionField
          subscriptions={subscriptions ?? []}
          query={query}
          datasource={datasource}
          subscriptionId={subscriptionId}
          variableOptionGroup={variableOptionGroup}
          onQueryChange={onChange}
          setError={setError}
        />

        <ResourceGroupsField
          resourceGroups={resourceGroups ?? []}
          query={query}
          datasource={datasource}
          subscriptionId={subscriptionId}
          variableOptionGroup={variableOptionGroup}
          onQueryChange={onChange}
          setError={setError}
        />
      </InlineFieldRow>

      <InlineFieldRow>
        <ResourceTypeField
          resourceTypes={resourceTypes ?? []}
          query={query}
          datasource={datasource}
          subscriptionId={subscriptionId}
          variableOptionGroup={variableOptionGroup}
          onQueryChange={onChange}
          setError={setError}
        />
        <ResourceNameField
          resourceNames={resourceNames ?? []}
          query={query}
          datasource={datasource}
          subscriptionId={subscriptionId}
          variableOptionGroup={variableOptionGroup}
          onQueryChange={onChange}
          setError={setError}
        />
      </InlineFieldRow>

      <InlineFieldRow>
        <MetricNamespaceField
          metricNamespaces={metricNamespaces ?? []}
          query={query}
          datasource={datasource}
          subscriptionId={subscriptionId}
          variableOptionGroup={variableOptionGroup}
          onQueryChange={onChange}
          setError={setError}
        />
        <MetricNameField
          metricNames={metricNames ?? []}
          query={query}
          datasource={datasource}
          subscriptionId={subscriptionId}
          variableOptionGroup={variableOptionGroup}
          onQueryChange={onChange}
          setError={setError}
        />
      </InlineFieldRow>
      <InlineFieldRow>
        <AggregationField
          query={query}
          datasource={datasource}
          subscriptionId={subscriptionId}
          variableOptionGroup={variableOptionGroup}
          onQueryChange={onChange}
          setError={setError}
          aggregationOptions={metricsMetadata?.aggOptions ?? []}
          isLoading={metricsMetadata.isLoading}
        />
        <TimeGrainField
          query={query}
          datasource={datasource}
          subscriptionId={subscriptionId}
          variableOptionGroup={variableOptionGroup}
          onQueryChange={onChange}
          setError={setError}
          timeGrainOptions={metricsMetadata?.timeGrains ?? []}
        />
      </InlineFieldRow>
      <DimensionFields
        query={query}
        datasource={datasource}
        subscriptionId={subscriptionId}
        variableOptionGroup={variableOptionGroup}
        onQueryChange={onChange}
        setError={setError}
        dimensionOptions={metricsMetadata?.dimensions ?? []}
      />
      <TopField
        query={query}
        datasource={datasource}
        subscriptionId={subscriptionId}
        variableOptionGroup={variableOptionGroup}
        onQueryChange={onChange}
        setError={setError}
      />
      <LegendFormatField
        query={query}
        datasource={datasource}
        subscriptionId={subscriptionId}
        variableOptionGroup={variableOptionGroup}
        onQueryChange={onChange}
        setError={setError}
      />
    </div>
  );
};

export default MetricsQueryEditor;
