import React from 'react';
import { AzureMonitorErrorish, AzureMonitorOption, AzureMonitorQuery } from '../../types';
import Datasource from '../../datasource';
import { Alert, InlineFieldRow } from '@grafana/ui';
import { ResourceRowType } from '../ResourcePicker/types';
import ResourceField from '../ResourceField';
import QueryField from './QueryField';
import FormatAsField from './FormatAsField';
import useMigrations from './useMigrations';
import { setResource } from './setQueryValue';

interface LogsQueryEditorProps {
  query: AzureMonitorQuery;
  datasource: Datasource;
  subscriptionId?: string;
  onChange: (newQuery: AzureMonitorQuery) => void;
  variableOptionGroup: { label: string; options: AzureMonitorOption[] };
  setError: (source: string, error: AzureMonitorErrorish | undefined) => void;
  hideFormatAs?: boolean;
}

const LogsQueryEditor: React.FC<LogsQueryEditorProps> = ({
  query,
  datasource,
  subscriptionId,
  variableOptionGroup,
  onChange,
  setError,
  hideFormatAs,
}) => {
  const migrationError = useMigrations(datasource, query, onChange);

  return (
    <div data-testid="azure-monitor-logs-query-editor">
      <InlineFieldRow>
        <ResourceField
          query={query}
          datasource={datasource}
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
          setResource={setResource}
          resourceUri={query.azureLogAnalytics?.resource}
        />
      </InlineFieldRow>

      <QueryField
        query={query}
        datasource={datasource}
        subscriptionId={subscriptionId}
        variableOptionGroup={variableOptionGroup}
        onQueryChange={onChange}
        setError={setError}
      />

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
    </div>
  );
};

export default LogsQueryEditor;
