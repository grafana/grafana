import React, { useCallback, useEffect } from 'react';
import { AzureMonitorErrorish, AzureMonitorOption, AzureMonitorQuery } from '../../types';
import Datasource from '../../datasource';
import { InlineFieldRow } from '@grafana/ui';
import QueryField from './QueryField';
import FormatAsField from './FormatAsField';
import ResourceField from './ResourceField';

interface LogsQueryEditorProps {
  query: AzureMonitorQuery;
  datasource: Datasource;
  subscriptionId: string;
  onChange: (newQuery: AzureMonitorQuery) => void;
  variableOptionGroup: { label: string; options: AzureMonitorOption[] };
  setError: (source: string, error: AzureMonitorErrorish | undefined) => void;
}

const LogsQueryEditor: React.FC<LogsQueryEditorProps> = ({
  query,
  datasource,
  subscriptionId,
  variableOptionGroup,
  onChange,
  setError,
}) => {
  const migrateWorkspaceQueriesToResourceQueries = useCallback(async () => {
    if (query.azureLogAnalytics.workspace !== undefined && !query.azureLogAnalytics.resource) {
      const resourceURI = await datasource.resourcePickerData.getResourceURIFromWorkspace(
        query.azureLogAnalytics.workspace
      );
      onChange({
        ...query,
        azureLogAnalytics: {
          ...query.azureLogAnalytics,
          resource: resourceURI,
          workspace: undefined,
        },
      });
    }
  }, [datasource, onChange, query]);

  useEffect(() => {
    migrateWorkspaceQueriesToResourceQueries();
  }, [query, migrateWorkspaceQueriesToResourceQueries]);

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

      <FormatAsField
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

export default LogsQueryEditor;
