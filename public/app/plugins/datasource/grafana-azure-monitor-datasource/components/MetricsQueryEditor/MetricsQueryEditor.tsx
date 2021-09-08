import React from 'react';

import Datasource from '../../datasource';
import { AzureMonitorQuery, AzureMonitorOption, AzureMonitorErrorish } from '../../types';
import MetricNamespaceField from './MetricNamespaceField';
import MetricNameField from './MetricNameField';
import AggregationField from './AggregationField';
import TimeGrainField from './TimeGrainField';
import DimensionFields from './DimensionFields';
import TopField from './TopField';
import LegendFormatField from './LegendFormatField';
import { InlineFieldRow } from '@grafana/ui';
import { useMetricNames, useMetricNamespaces, useMetricMetadata } from './dataHooks';
import ResourceField from './ResourceField';

interface MetricsQueryEditorProps {
  query: AzureMonitorQuery;
  datasource: Datasource;
  subscriptionId?: string;
  onChange: (newQuery: AzureMonitorQuery) => void;
  variableOptionGroup: { label: string; options: AzureMonitorOption[] };
  setError: (source: string, error: AzureMonitorErrorish | undefined) => void;
}

const MetricsQueryEditor: React.FC<MetricsQueryEditorProps> = ({
  query,
  datasource,
  subscriptionId,
  variableOptionGroup,
  onChange,
  setError,
}) => {
  const metricsMetadata = useMetricMetadata(query, datasource, onChange);
  const metricNamespaces = useMetricNamespaces(query, datasource, onChange, setError);
  const metricNames = useMetricNames(query, datasource, onChange, setError);

  return (
    <div data-testid="azure-monitor-metrics-query-editor">
      <InlineFieldRow>
        <ResourceField
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
          metricNamespaces={metricNamespaces}
          query={query}
          datasource={datasource}
          subscriptionId={subscriptionId}
          variableOptionGroup={variableOptionGroup}
          onQueryChange={onChange}
          setError={setError}
        />
        <MetricNameField
          metricNames={metricNames}
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
