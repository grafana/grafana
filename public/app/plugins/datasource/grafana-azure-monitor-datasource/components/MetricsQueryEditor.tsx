import React from 'react';

import { SelectableValue } from '@grafana/data';
import { Button, InlineField, Select } from '@grafana/ui';

import Datasource from '../datasource';
import { AzureMonitorQuery } from '../types';
import MetricNamespaceField from './MetricsQueryEditor/MetricNamespaceField';
import NamespaceField from './MetricsQueryEditor/NamespaceField';
import ResourceGroupsField from './MetricsQueryEditor/ResourceGroupsField';
import ResourceNameField from './MetricsQueryEditor/ResourceNameField';
import MetricNameField from './MetricsQueryEditor/MetricNameField';
import AggregationField from './MetricsQueryEditor/AggregationField';
import { useMetricsMetadata } from './metrics';

interface MetricsQueryEditorProps {
  query: AzureMonitorQuery;
  datasource: Datasource;
  subscriptionId: string;
  replaceTemplateVariable: (variable: string) => string;
  onQueryChange: (newQuery: AzureMonitorQuery) => void;
}

const noop = (...args: any) => console.log(...args);
const opt = (value: string) => ({ value, label: value });

const labelWidth = 16;

const MetricsQueryEditor: React.FC<MetricsQueryEditorProps> = ({
  query,
  datasource,
  subscriptionId,
  replaceTemplateVariable,
  onQueryChange,
}) => {
  const metricsMetadata = useMetricsMetadata(datasource, query, subscriptionId, replaceTemplateVariable, onQueryChange);

  // Single dynamic onChange function might be a bit unwieldly. Let's see how it goes.
  // This type magic ensures its only ever called with key/value pairs of the azureMonitor object
  function onFieldChange<Key extends keyof AzureMonitorQuery['azureMonitor']>(
    field: Key,
    { value }: SelectableValue<AzureMonitorQuery['azureMonitor'][Key]>
  ) {
    // TODO: investigate empty values. Do they still need to be set?
    // TODO: when fields change, we actually need to unset all the "lower" fields that depend on this as well
    value &&
      onQueryChange({
        ...query,
        azureMonitor: {
          ...query.azureMonitor,
          [field]: value,
        },
      });
  }

  return (
    <>
      <InlineField label="Subscription" labelWidth={labelWidth}>
        <Select value={opt(query.subscription)} onChange={noop} options={[]} />
      </InlineField>

      <ResourceGroupsField
        query={query}
        datasource={datasource}
        subscriptionId={subscriptionId}
        onChange={onFieldChange}
        replaceTemplateVariable={replaceTemplateVariable}
      />

      <NamespaceField
        query={query}
        datasource={datasource}
        subscriptionId={subscriptionId}
        onChange={onFieldChange}
        replaceTemplateVariable={replaceTemplateVariable}
      />

      <ResourceNameField
        query={query}
        datasource={datasource}
        subscriptionId={subscriptionId}
        onChange={onFieldChange}
        replaceTemplateVariable={replaceTemplateVariable}
      />

      <MetricNamespaceField
        query={query}
        datasource={datasource}
        subscriptionId={subscriptionId}
        onChange={onFieldChange}
        replaceTemplateVariable={replaceTemplateVariable}
      />

      <MetricNameField
        query={query}
        datasource={datasource}
        subscriptionId={subscriptionId}
        onChange={onFieldChange}
        replaceTemplateVariable={replaceTemplateVariable}
      />

      <AggregationField
        query={query}
        datasource={datasource}
        subscriptionId={subscriptionId}
        onChange={onFieldChange}
        replaceTemplateVariable={replaceTemplateVariable}
        aggregationOptions={metricsMetadata?.aggOptions ?? []}
      />

      <InlineField label="Aggregation" labelWidth={labelWidth}>
        <Select value={opt(query.azureMonitor.aggregation)} onChange={noop} options={[]} />
      </InlineField>

      <InlineField label="Time Grain" labelWidth={labelWidth}>
        <Select value={opt(query.azureMonitor.timeGrain)} onChange={noop} options={[]} />
      </InlineField>

      <InlineField label="Dimension" labelWidth={labelWidth}>
        <Button variant="secondary" size="md">
          Add
        </Button>
      </InlineField>
    </>
  );
};

export default MetricsQueryEditor;
