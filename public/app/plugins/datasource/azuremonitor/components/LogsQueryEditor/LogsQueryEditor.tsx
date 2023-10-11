import React, { useEffect, useState } from 'react';

import { EditorFieldGroup, EditorRow, EditorRows, Stack } from '@grafana/experimental';
import { reportInteraction } from '@grafana/runtime';
import { Alert, Button } from '@grafana/ui';

import Datasource from '../../datasource';
import { selectors } from '../../e2e/selectors';
import {
  AzureMonitorErrorish,
  AzureMonitorOption,
  AzureMonitorQuery,
  ResultFormat,
  EngineSchema,
  AzureQueryType,
} from '../../types';
import FormatAsField from '../FormatAsField';
import ResourceField from '../ResourceField';
import { ResourceRow, ResourceRowGroup, ResourceRowType } from '../ResourcePicker/types';
import { parseResourceDetails } from '../ResourcePicker/utils';

import AdvancedResourcePicker from './AdvancedResourcePicker';
import { AzureCheatSheetModal } from './AzureCheatSheetModal';
import QueryField from './QueryField';
import { TimeManagement } from './TimeManagement';
import { setFormatAs } from './setQueryValue';
import useMigrations from './useMigrations';

interface LogsQueryEditorProps {
  query: AzureMonitorQuery;
  datasource: Datasource;
  subscriptionId?: string;
  onChange: (newQuery: AzureMonitorQuery) => void;
  variableOptionGroup: { label: string; options: AzureMonitorOption[] };
  setError: (source: string, error: AzureMonitorErrorish | undefined) => void;
  hideFormatAs?: boolean;
}

const LogsQueryEditor = ({
  query,
  datasource,
  subscriptionId,
  variableOptionGroup,
  onChange,
  setError,
  hideFormatAs,
}: LogsQueryEditorProps) => {
  const migrationError = useMigrations(datasource, query, onChange);
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
  const [schema, setSchema] = useState<EngineSchema | undefined>();
  const [azureLogsCheatSheetModalOpen, setAzureLogsCheatSheetModalOpen] = useState(false);

  useEffect(() => {
    if (query.azureLogAnalytics?.resources && query.azureLogAnalytics.resources.length) {
      datasource.azureLogAnalyticsDatasource.getKustoSchema(query.azureLogAnalytics.resources[0]).then((schema) => {
        setSchema(schema);
      });
    }
  }, [query.azureLogAnalytics?.resources, datasource.azureLogAnalyticsDatasource]);

  return (
    <span data-testid={selectors.components.queryEditor.logsQueryEditor.container.input}>
      <AzureCheatSheetModal
        datasource={datasource.azureLogAnalyticsDatasource}
        isOpen={azureLogsCheatSheetModalOpen}
        onClose={() => setAzureLogsCheatSheetModalOpen(false)}
        onChange={(a) => onChange({ ...a, queryType: AzureQueryType.LogAnalytics })}
      />
      <EditorRows>
        <EditorRow>
          <EditorFieldGroup>
            <Stack gap={1} alignItems="center">
              <Button
                aria-label="Azure logs kick start your query button"
                variant="secondary"
                size="sm"
                onClick={() => {
                  setAzureLogsCheatSheetModalOpen((prevValue) => !prevValue);

                  reportInteraction('grafana_azure_logs_query_patterns_opened', {
                    version: 'v2',
                    editorMode: query.azureLogAnalytics,
                  });
                }}
              >
                Kick start your query
              </Button>
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
              <TimeManagement
                query={query}
                datasource={datasource}
                variableOptionGroup={variableOptionGroup}
                onQueryChange={onChange}
                setError={setError}
                schema={schema}
              />
            </Stack>
          </EditorFieldGroup>
        </EditorRow>
        <QueryField
          query={query}
          datasource={datasource}
          subscriptionId={subscriptionId}
          variableOptionGroup={variableOptionGroup}
          onQueryChange={onChange}
          setError={setError}
          schema={schema}
        />
        <EditorRow>
          <EditorFieldGroup>
            {!hideFormatAs && (
              <FormatAsField
                query={query}
                datasource={datasource}
                subscriptionId={subscriptionId}
                variableOptionGroup={variableOptionGroup}
                onQueryChange={onChange}
                setError={setError}
                inputId={'azure-monitor-logs'}
                options={[
                  { label: 'Time series', value: ResultFormat.TimeSeries },
                  { label: 'Table', value: ResultFormat.Table },
                ]}
                defaultValue={ResultFormat.Table}
                setFormatAs={setFormatAs}
                resultFormat={query.azureLogAnalytics?.resultFormat}
              />
            )}

            {migrationError && <Alert title={migrationError.title}>{migrationError.message}</Alert>}
          </EditorFieldGroup>
        </EditorRow>
      </EditorRows>
    </span>
  );
};

export default LogsQueryEditor;
