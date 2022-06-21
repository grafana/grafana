import { css } from '@emotion/css';
import React from 'react';

import { PanelData } from '@grafana/data/src/types';
import { EditorRows, EditorRow, EditorFieldGroup } from '@grafana/experimental';
import { config } from '@grafana/runtime';
import { InlineFieldRow, useStyles2 } from '@grafana/ui';

import type Datasource from '../../datasource';
import type { AzureMonitorQuery, AzureMonitorOption, AzureMonitorErrorish } from '../../types';
import ResourceField from '../ResourceField';
import { ResourceRowType } from '../ResourcePicker/types';

import AggregationField from './AggregationField';
import DimensionFields from './DimensionFields';
import LegendFormatField from './LegendFormatField';
import MetricNameField from './MetricNameField';
import MetricNamespaceField from './MetricNamespaceField';
import NewDimensionFields from './NewDimensionFields';
import TimeGrainField from './TimeGrainField';
import TopField from './TopField';
import { useMetricNames, useMetricNamespaces, useMetricMetadata } from './dataHooks';
import { setResource } from './setQueryValue';

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
  const styles = useStyles2(getStyles);

  const metricsMetadata = useMetricMetadata(query, datasource, onChange);
  const metricNamespaces = useMetricNamespaces(query, datasource, onChange, setError);
  const metricNames = useMetricNames(query, datasource, onChange, setError);
  if (config.featureToggles.azureMonitorExperimentalUI) {
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
                setResource={setResource}
                resourceUri={query.azureMonitor?.resourceUri}
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
            </EditorFieldGroup>
          </EditorRow>
          <EditorRow>
            <EditorFieldGroup>
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
              <NewDimensionFields
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
  } else {
    return (
      <div data-testid="azure-monitor-metrics-query-editor-with-resource-picker">
        <InlineFieldRow className={styles.row}>
          <ResourceField
            query={query}
            datasource={datasource}
            variableOptionGroup={variableOptionGroup}
            onQueryChange={onChange}
            setError={setError}
            selectableEntryTypes={[ResourceRowType.Resource]}
            setResource={setResource}
            resourceUri={query.azureMonitor?.resourceUri}
            queryType="metrics"
          />
        </InlineFieldRow>

        <InlineFieldRow className={styles.row}>
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
        </InlineFieldRow>
        <InlineFieldRow className={styles.row}>
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
        </InlineFieldRow>
        <DimensionFields
          data={data}
          query={query}
          datasource={datasource}
          variableOptionGroup={variableOptionGroup}
          onQueryChange={onChange}
          setError={setError}
          dimensionOptions={metricsMetadata?.dimensions ?? []}
        />
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
      </div>
    );
  }
};

const getStyles = () => ({
  row: css({
    rowGap: 0,
  }),
});

export default MetricsQueryEditor;
