import { type PanelData } from '@grafana/data';
import { t } from '@grafana/i18n';
import { EditorRows, EditorRow, EditorFieldGroup } from '@grafana/plugin-ui';

import { multiResourceCompatibleTypes } from '../../azureMetadata/resourceTypes';
import { type AzureMonitorResource } from '../../dataquery.gen';
import type Datasource from '../../datasource';
import { selectors } from '../../e2e/selectors';
import { type AzureMonitorQuery } from '../../types/query';
import { type AzureMonitorOption, type AzureMonitorErrorish } from '../../types/types';
import ResourceField from '../ResourceField/ResourceField';
import { type ResourceRow, type ResourceRowGroup, ResourceRowType } from '../ResourcePicker/types';
import { parseResourceDetails } from '../ResourcePicker/utils';

import AdvancedResourcePicker from './AdvancedResourcePicker';
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

const supportsMultipleResources = (namespace?: string): boolean =>
  multiResourceCompatibleTypes[namespace?.toLocaleLowerCase() ?? ''] ?? false;

// isBatchableNamespace reports whether a metric namespace can be queried through the
// Metrics Batch API. Guest OS metrics ("azure.vm.*") and legacy Windows Azure Diagnostics
// ("windows azure"/"wad") namespaces are not resource types and are only available via the
// legacy ARM metrics endpoint, so they cannot be batched. This mirrors isBatchableModel in
// the backend batch executor (pkg/tsdb/azuremonitor/metrics/batch-executor.go).
export const isBatchableNamespace = (namespace?: string): boolean => {
  const ns = namespace?.toLocaleLowerCase().trim() ?? '';
  return !(ns.startsWith('azure.vm.') || ns.startsWith('windows azure') || ns.startsWith('wad'));
};

// isResourceRowDisabled decides whether a resource row can be added to the current
// selection. With the batch API enabled, resources only need to share a metric namespace
// (they can span subscriptions and regions); otherwise they must also share the same
// subscription and region and use a multi-resource-compatible namespace.
export const isResourceRowDisabled = (
  row: ResourceRow,
  selectedRows: ResourceRowGroup,
  batchAPIEnabled?: boolean
): boolean => {
  const rowResource = parseResourceDetails(row.uri, row.location);
  if (batchAPIEnabled && row.type === ResourceRowType.Resource && !isBatchableNamespace(rowResource.metricNamespace)) {
    return true;
  }

  // Only disable rows once something is already selected.
  if (selectedRows.length === 0) {
    return false;
  }

  const selectedRowSample = parseResourceDetails(selectedRows[0].uri, selectedRows[0].location);

  if (batchAPIEnabled) {
    // Never grey out subscriptions/resource groups — they're containers that may hold selectable resources.
    if (row.type === ResourceRowType.Subscription || row.type === ResourceRowType.ResourceGroup) {
      return false;
    }
    return rowResource.metricNamespace?.toLocaleLowerCase() !== selectedRowSample.metricNamespace?.toLocaleLowerCase();
  }

  return (
    rowResource.subscription !== selectedRowSample.subscription ||
    rowResource.region !== selectedRowSample.region ||
    rowResource.metricNamespace?.toLocaleLowerCase() !== selectedRowSample.metricNamespace?.toLocaleLowerCase() ||
    !supportsMultipleResources(rowResource.metricNamespace)
  );
};

// getSelectionNotice returns the helper text shown under the resource picker for the
// current selection. The text differs when the batch API is enabled.
export const getSelectionNotice = (selectedRows: ResourceRowGroup, batchAPIEnabled?: boolean): string => {
  if (selectedRows.length === 0) {
    return '';
  }
  if (batchAPIEnabled) {
    return t(
      'components.metrics-query-editor.selection-notice-batch',
      'You can select items of the same resource type across subscriptions and regions. Resources in different subscriptions or regions are queried in separate requests and may fail independently. To select resources of a different resource type, please first uncheck your current selection.'
    );
  }
  const selectedRowSample = parseResourceDetails(selectedRows[0].uri, selectedRows[0].location);
  return supportsMultipleResources(selectedRowSample.metricNamespace)
    ? t(
        'components.metrics-query-editor.selection-notice-standard',
        'You can select items of the same resource type and location. To select resources of a different resource type or location, please first uncheck your current selection.'
      )
    : '';
};

const MetricsQueryEditor = ({
  data,
  query,
  datasource,
  variableOptionGroup,
  onChange,
  setError,
}: MetricsQueryEditorProps) => {
  const metricsMetadata = useMetricMetadata(query, datasource, onChange);
  const metricNamespaces = useMetricNamespaces(query, datasource, onChange, setError);
  const metricNames = useMetricNames(query, datasource, onChange, setError);
  const resources =
    query.azureMonitor?.resources?.map((r) => ({
      // Prefer each resource's own subscription/region (batch selections can span both) and
      // fall back to the query-level values for single-resource / non-batch queries.
      subscription: r.subscription ?? query.subscription,
      resourceGroup: r.resourceGroup,
      metricNamespace: query.azureMonitor?.metricNamespace,
      resourceName: r.resourceName,
      region: r.region ?? query.azureMonitor?.region,
    })) ?? [];

  const batchAPIEnabled = datasource.azureMonitorDatasource.batchAPIEnabled;

  const selectableMetricNamespaces = batchAPIEnabled
    ? metricNamespaces.filter((option) => isBatchableNamespace(option.value))
    : metricNamespaces;

  const disableRow = (row: ResourceRow, selectedRows: ResourceRowGroup) =>
    isResourceRowDisabled(row, selectedRows, batchAPIEnabled);

  const selectionNotice = (selectedRows: ResourceRowGroup) => getSelectionNotice(selectedRows, batchAPIEnabled);

  return (
    <span data-testid={selectors.components.queryEditor.metricsQueryEditor.container.input}>
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
              resources={resources ?? []}
              queryType={'metrics'}
              disableRow={disableRow}
              renderAdvanced={(resources, onChange) => (
                // It's required to cast resources because the resource picker
                // specifies the type to string | AzureMonitorResource.
                // eslint-disable-next-line
                <AdvancedResourcePicker resources={resources as AzureMonitorResource[]} onChange={onChange} />
              )}
              selectionNotice={selectionNotice}
            />
            <MetricNamespaceField
              metricNamespaces={selectableMetricNamespaces}
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
