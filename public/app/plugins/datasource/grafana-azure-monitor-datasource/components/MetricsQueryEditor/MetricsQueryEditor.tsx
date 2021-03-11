import React from 'react';

import Datasource from '../../datasource';
import { AzureMonitorQuery, AzureMonitorOption } from '../../types';
import { useMetricsMetadata } from '../metrics';
import SubscriptionField from '../SubscriptionField';
import MetricNamespaceField from './MetricNamespaceField';
import NamespaceField from './NamespaceField';
import ResourceGroupsField from './ResourceGroupsField';
import ResourceNameField from './ResourceNameField';
import MetricNameField from './MetricNameField';
import AggregationField from './AggregationField';
import TimeGrainField from './TimeGrainField';
import DimensionFields from './DimensionFields';
import TopField from './TopField';
import LegendFormatField from './LegendFormatField';
import { InlineFieldRow } from '@grafana/ui';

interface MetricsQueryEditorProps {
  query: AzureMonitorQuery;
  datasource: Datasource;
  subscriptionId: string;
  onChange: (newQuery: AzureMonitorQuery) => void;
  variableOptionGroup: { label: string; options: AzureMonitorOption[] };
  onError: (err: Error) => void;
}

const MetricsQueryEditor: React.FC<MetricsQueryEditorProps> = ({
  query,
  datasource,
  subscriptionId,
  variableOptionGroup,
  onChange,
  onError,
}) => {
  const metricsMetadata = useMetricsMetadata(datasource, query, subscriptionId, onChange);

  return (
    <div data-testid="azure-monitor-metrics-query-editor">
      <InlineFieldRow>
        <SubscriptionField
          query={query}
          datasource={datasource}
          subscriptionId={subscriptionId}
          variableOptionGroup={variableOptionGroup}
          onQueryChange={onChange}
          onError={onError}
        />

        <ResourceGroupsField
          query={query}
          datasource={datasource}
          subscriptionId={subscriptionId}
          variableOptionGroup={variableOptionGroup}
          onQueryChange={onChange}
          onError={onError}
        />
      </InlineFieldRow>

      <InlineFieldRow>
        <NamespaceField
          query={query}
          datasource={datasource}
          subscriptionId={subscriptionId}
          variableOptionGroup={variableOptionGroup}
          onQueryChange={onChange}
          onError={onError}
        />
        <ResourceNameField
          query={query}
          datasource={datasource}
          subscriptionId={subscriptionId}
          variableOptionGroup={variableOptionGroup}
          onQueryChange={onChange}
          onError={onError}
        />
      </InlineFieldRow>

      <InlineFieldRow>
        <MetricNamespaceField
          query={query}
          datasource={datasource}
          subscriptionId={subscriptionId}
          variableOptionGroup={variableOptionGroup}
          onQueryChange={onChange}
          onError={onError}
        />
        <MetricNameField
          query={query}
          datasource={datasource}
          subscriptionId={subscriptionId}
          variableOptionGroup={variableOptionGroup}
          onQueryChange={onChange}
          onError={onError}
        />
      </InlineFieldRow>
      <InlineFieldRow>
        <AggregationField
          query={query}
          datasource={datasource}
          subscriptionId={subscriptionId}
          variableOptionGroup={variableOptionGroup}
          onQueryChange={onChange}
          onError={onError}
          aggregationOptions={metricsMetadata?.aggOptions ?? []}
        />
        <TimeGrainField
          query={query}
          datasource={datasource}
          subscriptionId={subscriptionId}
          variableOptionGroup={variableOptionGroup}
          onQueryChange={onChange}
          onError={onError}
          timeGrainOptions={metricsMetadata?.timeGrains ?? []}
        />
      </InlineFieldRow>
      <DimensionFields
        query={query}
        datasource={datasource}
        subscriptionId={subscriptionId}
        variableOptionGroup={variableOptionGroup}
        onQueryChange={onChange}
        onError={onError}
        dimensionOptions={metricsMetadata?.dimensions ?? []}
      />
      <TopField
        query={query}
        datasource={datasource}
        subscriptionId={subscriptionId}
        variableOptionGroup={variableOptionGroup}
        onQueryChange={onChange}
        onError={onError}
      />
      <LegendFormatField
        query={query}
        datasource={datasource}
        subscriptionId={subscriptionId}
        variableOptionGroup={variableOptionGroup}
        onQueryChange={onChange}
        onError={onError}
      />
    </div>
  );
};

export default MetricsQueryEditor;
