import React from 'react';

import { EditorFieldGroup, EditorRow, EditorRows } from '@grafana/experimental';
import { Alert } from '@grafana/ui';

import Datasource from '../../datasource';
import { AzureMonitorErrorish, AzureMonitorOption, AzureMonitorQuery } from '../../types';
import ResourceField from '../ResourceField';
import { ResourceRow, ResourceRowGroup, ResourceRowType } from '../ResourcePicker/types';
import { parseResourceDetails } from '../ResourcePicker/utils';

import AdvancedResourcePicker from './AdvancedResourcePicker';
import FormatAsField from './FormatAsField';
import QueryField from './QueryField';
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
        <QueryField
          query={query}
          datasource={datasource}
          subscriptionId={subscriptionId}
          variableOptionGroup={variableOptionGroup}
          onQueryChange={onChange}
          setError={setError}
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
