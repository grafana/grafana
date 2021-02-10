import React from 'react';

import Datasource from '../../datasource';
import { AzureMonitorQuery } from '../../types';
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

interface MetricsQueryEditorProps {
  query: AzureMonitorQuery;
  datasource: Datasource;
  subscriptionId: string;
  onChange: (newQuery: AzureMonitorQuery) => void;
}

const MetricsQueryEditor: React.FC<MetricsQueryEditorProps> = ({ query, datasource, subscriptionId, onChange }) => {
  const metricsMetadata = useMetricsMetadata(datasource, query, subscriptionId, onChange);

  return (
    <>
      <SubscriptionField
        query={query}
        datasource={datasource}
        subscriptionId={subscriptionId}
        onQueryChange={onChange}
      />

      <ResourceGroupsField
        query={query}
        datasource={datasource}
        subscriptionId={subscriptionId}
        onQueryChange={onChange}
      />

      <NamespaceField query={query} datasource={datasource} subscriptionId={subscriptionId} onQueryChange={onChange} />

      <ResourceNameField
        query={query}
        datasource={datasource}
        subscriptionId={subscriptionId}
        onQueryChange={onChange}
      />

      {/* TODO: Can we hide this field if there's only one option, and its the same as the namespace? */}
      <MetricNamespaceField
        query={query}
        datasource={datasource}
        subscriptionId={subscriptionId}
        onQueryChange={onChange}
      />

      <MetricNameField query={query} datasource={datasource} subscriptionId={subscriptionId} onQueryChange={onChange} />

      <AggregationField
        query={query}
        datasource={datasource}
        subscriptionId={subscriptionId}
        onQueryChange={onChange}
        aggregationOptions={metricsMetadata?.aggOptions ?? []}
      />

      <TimeGrainField
        query={query}
        datasource={datasource}
        subscriptionId={subscriptionId}
        onQueryChange={onChange}
        timeGrainOptions={metricsMetadata?.timeGrains ?? []}
      />

      <DimensionFields
        query={query}
        datasource={datasource}
        subscriptionId={subscriptionId}
        onQueryChange={onChange}
        dimensionOptions={metricsMetadata?.dimensions ?? []}
      />

      <TopField query={query} datasource={datasource} subscriptionId={subscriptionId} onQueryChange={onChange} />

      <LegendFormatField
        query={query}
        datasource={datasource}
        subscriptionId={subscriptionId}
        onQueryChange={onChange}
      />
    </>
  );
};

export default MetricsQueryEditor;
