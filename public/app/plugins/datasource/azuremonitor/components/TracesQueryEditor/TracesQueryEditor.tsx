import React, { useState } from 'react';
import { createFilter } from 'react-select';
import { lastValueFrom } from 'rxjs';

import { CoreApp, DataFrame, SelectableValue, TimeRange } from '@grafana/data';
import { EditorFieldGroup, EditorRow, EditorRows } from '@grafana/experimental';
import { VirtualizedSelect } from '@grafana/ui';

import Datasource from '../../datasource';
import { AzureMonitorErrorish, AzureMonitorOption, AzureMonitorQuery, AzureQueryType, ResultFormat } from '../../types';
import { useAsyncState } from '../../utils/useAsyncState';
import { Field } from '../Field';
import FormatAsField from '../FormatAsField';
import AdvancedResourcePicker from '../LogsQueryEditor/AdvancedResourcePicker';
import ResourceField from '../ResourceField';
import { ResourceRow, ResourceRowGroup, ResourceRowType } from '../ResourcePicker/types';
import { parseResourceDetails } from '../ResourcePicker/utils';

import { setKustoQuery } from './setQueryValue';

interface TracesQueryEditorProps {
  query: AzureMonitorQuery;
  datasource: Datasource;
  subscriptionId?: string;
  onChange: (newQuery: AzureMonitorQuery) => void;
  variableOptionGroup: { label: string; options: AzureMonitorOption[] };
  setError: (source: string, error: AzureMonitorErrorish | undefined) => void;
}

const useOperationIds = (
  query: AzureMonitorQuery,
  datasource: Datasource,
  setError: (source: string, error: AzureMonitorErrorish | undefined) => void,
  timeRange: TimeRange
): Array<SelectableValue<string>> => {
  const resources = query.azureLogAnalytics?.resources;
  return useAsyncState(
    async () => {
      const { azureLogAnalytics } = query;
      if (!azureLogAnalytics) {
        return;
      }

      const { resources } = azureLogAnalytics;

      if (!resources) {
        return;
      }
      const operationIdQuery = `union isfuzzy=true traces, customEvents, pageViews, requests, dependencies, exceptions, availabilityResults
      | where $__timeFilter()
      | project operation_Id
      | distinct operation_Id`;
      const results = await lastValueFrom(
        datasource.azureLogAnalyticsDatasource.query({
          requestId: 'azure-traces-operationid-req',
          interval: '',
          intervalMs: 0,
          scopedVars: {},
          timezone: '',
          startTime: 0,
          app: CoreApp.Unknown,
          targets: [
            {
              ...query,
              azureLogAnalytics: {
                ...query.azureLogAnalytics,
                operationId: '',
                query: operationIdQuery,
              },
              queryType: AzureQueryType.AzureTraces,
            },
          ],
          range: timeRange,
        })
      );
      if (results.data.length > 0) {
        const result: DataFrame = results.data[0];
        if (result.fields.length > 0) {
          return result.fields[0].values.toArray().map((operationId) => ({ label: operationId, value: operationId }));
        }
        return [];
      }
      return [];
    },
    setError,
    [datasource, resources, timeRange]
  );
};

const TracesQueryEditor = ({
  query,
  datasource,
  subscriptionId,
  variableOptionGroup,
  onChange,
  setError,
}: TracesQueryEditorProps) => {
  const disableRow = (row: ResourceRow, selectedRows: ResourceRowGroup) => {
    if (selectedRows.length === 0) {
      // Only if there is some resource(s) selected we should disable rows
      return false;
    }
    const rowResourceNS = parseResourceDetails(row.uri, row.location).metricNamespace?.toLowerCase();
    const selectedRowSampleNs = parseResourceDetails(
      selectedRows[0].uri,
      selectedRows[0].location
    ).metricNamespace?.toLowerCase();
    // Only resources with the same metricNamespace can be selected
    return rowResourceNS !== selectedRowSampleNs;
  };
  const [timeRange, setTimeRange] = useState<TimeRange>({
    ...datasource.azureLogAnalyticsDatasource.timeSrv.timeRange(),
  });

  const useTime = (time: TimeRange) => {
    if (
      timeRange !== null &&
      (timeRange.raw.from !== time.raw.from || timeRange.raw.to !== time.raw.to) &&
      !query.azureLogAnalytics?.operationId
    ) {
      setTimeRange({ ...time });
    }
  };

  useTime(datasource.azureLogAnalyticsDatasource.timeSrv.timeRange());

  const operationIds = useOperationIds(query, datasource, setError, timeRange);

  const onOperationIdChange = ({ value }: SelectableValue<string>) => {
    if (value) {
      const newQuery = setKustoQuery(query, value);
      onChange(newQuery);
    } else {
      onChange({
        ...query,
        azureLogAnalytics: {
          ...query.azureLogAnalytics,
          query: '',
        },
      });
    }
  };

  const _customFilter = createFilter({ ignoreAccents: false });
  const customFilter = (option: SelectableValue, searchQuery: string) =>
    _customFilter({ label: option.label ?? '', value: option.value ?? '', data: {} }, searchQuery);

  return (
    <span data-testid="azure-monitor-logs-query-editor-with-experimental-ui">
      <EditorRows>
        <EditorRow>
          <EditorFieldGroup>
            <ResourceField
              query={query}
              datasource={datasource}
              inlineField={true}
              labelWidth={10}
              subscriptionId={subscriptionId}
              variableOptionGroup={variableOptionGroup}
              onQueryChange={onChange}
              setError={setError}
              selectableEntryTypes={[
                ResourceRowType.Subscription,
                ResourceRowType.ResourceGroup,
                ResourceRowType.Resource,
                ResourceRowType.Variable,
              ]}
              resources={query.azureLogAnalytics?.resources ?? []}
              queryType="logs"
              disableRow={disableRow}
              renderAdvanced={(resources, onChange) => (
                // It's required to cast resources because the resource picker
                // specifies the type to string | AzureMonitorResource.
                // eslint-disable-next-line
                <AdvancedResourcePicker resources={resources as string[]} onChange={onChange} />
              )}
              selectionNotice={() => 'You may only choose items of the same resource type.'}
            />
          </EditorFieldGroup>
        </EditorRow>
        <EditorRow>
          <EditorFieldGroup>
            <Field label="Operation ID">
              <VirtualizedSelect
                filterOption={customFilter}
                inputId="azure-monitor-traces-operation-id-field"
                value={query.azureLogAnalytics?.operationId || null}
                onChange={onOperationIdChange}
                options={operationIds}
                allowCustomValue
              />
            </Field>
            <FormatAsField
              datasource={datasource}
              setError={setError}
              query={query}
              variableOptionGroup={variableOptionGroup}
              onQueryChange={onChange}
              inputId="azure-monitor-traces"
              options={[
                { label: 'Table', value: ResultFormat.Table },
                { label: 'Trace', value: ResultFormat.Trace },
              ]}
              defaultValue={ResultFormat.Table}
            />
          </EditorFieldGroup>
        </EditorRow>
      </EditorRows>
    </span>
  );
};

export default TracesQueryEditor;
