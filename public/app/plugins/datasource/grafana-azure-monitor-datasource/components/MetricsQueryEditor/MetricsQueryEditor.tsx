import React from 'react';

import { PanelData } from '@grafana/data/src/types';
import { EditorRows, EditorRow, EditorFieldGroup } from '@grafana/experimental';

import type Datasource from '../../datasource';
import type { AzureMonitorQuery, AzureMonitorOption, AzureMonitorErrorish, AzureMetricResource } from '../../types';
import ResourceField from '../ResourceField';
import { ResourceRowType } from '../ResourcePicker/types';

import AggregationField from './AggregationField';
import DimensionFields from './DimensionFields';
import LegendFormatField from './LegendFormatField';
import MetricNameField from './MetricNameField';
import MetricNamespaceField from './MetricNamespaceField';
import TimeGrainField from './TimeGrainField';
import TopField from './TopField';
import { useMetricNames, useMetricNamespaces, useMetricMetadata } from './dataHooks';

interface MetricsQueryEditorProps {
  data: PanelData | undefined;
  query: AzureMonitorQuery;
  datasource: Datasource;
  onChange: (newQuery: AzureMonitorQuery) => void;
  variableOptionGroup: { label: string; options: AzureMonitorOption[] };
  setError: (source: string, error: AzureMonitorErrorish | undefined) => void;
}

const MetricsQueryEditor: React.FC<MetricsQueryEditorProps> = ({
  data,
  query,
  datasource,
  variableOptionGroup,
  onChange,
  setError,
}) => {
  const metricsMetadata = useMetricMetadata(query, datasource, onChange);
  const metricNamespaces = useMetricNamespaces(query, datasource, onChange, setError);
  const metricNames = useMetricNames(query, datasource, onChange, setError);
  const resource: AzureMetricResource = {
    subscription: query.subscription,
    resourceGroup: query.azureMonitor?.resourceGroup,
    metricNamespace: query.azureMonitor?.metricNamespace,
    resourceName: query.azureMonitor?.resourceName,
  };
  return (
    <span data-testid="azure-monitor-metrics-query-editor-with-experimental-ui">
      <EditorRows>
        <EditorRow>
          <EditorFieldGroup>
            <ResourceField
              query={query}
              datasource={datasource}
              variableOptionGroup={variableOptionGroup}
              onQueryChange={onChange}
              setError={setError}
              selectableEntryTypes={[ResourceRowType.Resource]}
              resource={resource}
              queryType={'metrics'}
            />
            <MetricNamespaceField
              metricNamespaces={metricNamespaces}
              query={query}
              datasource={datasource}
              variableOptionGroup={variableOptionGroup}
              onQueryChange={onChange}
              setError={setError}
            />
            <MetricNameField
              metricNames={metricNames}
              query={query}
              datasource={datasource}
              variableOptionGroup={variableOptionGroup}
              onQueryChange={onChange}
              setError={setError}
            />
            <AggregationField
              query={query}
              datasource={datasource}
              variableOptionGroup={variableOptionGroup}
              onQueryChange={onChange}
              setError={setError}
              aggregationOptions={metricsMetadata?.aggOptions ?? []}
              isLoading={metricsMetadata.isLoading}
            />
            <TimeGrainField
              query={query}
              datasource={datasource}
              variableOptionGroup={variableOptionGroup}
              onQueryChange={onChange}
              setError={setError}
              timeGrainOptions={metricsMetadata?.timeGrains ?? []}
            />
          </EditorFieldGroup>
        </EditorRow>
        <EditorRow>
          <EditorFieldGroup>
            <DimensionFields
              data={data}
              query={query}
              datasource={datasource}
              variableOptionGroup={variableOptionGroup}
              onQueryChange={onChange}
              setError={setError}
              dimensionOptions={metricsMetadata?.dimensions ?? []}
            />
          </EditorFieldGroup>
        </EditorRow>
        <EditorRow>
          <EditorFieldGroup>
            <TopField
              query={query}
              datasource={datasource}
              variableOptionGroup={variableOptionGroup}
              onQueryChange={onChange}
              setError={setError}
            />
            <LegendFormatField
              query={query}
              datasource={datasource}
              variableOptionGroup={variableOptionGroup}
              onQueryChange={onChange}
              setError={setError}
            />
          </EditorFieldGroup>
        </EditorRow>
      </EditorRows>
    </span>
  );
};

export default MetricsQueryEditor;
