import React from 'react';

import { Alert } from '@grafana/ui';

import Datasource from '../../datasource';
import { AzureMonitorErrorish, AzureMonitorOption, AzureMonitorQuery } from '../../types';
import ResourceField from '../ResourceField';
import { ResourceRowType } from '../ResourcePicker/types';

import FormatAsField from './FormatAsField';
import QueryField from './QueryField';
import { setResource } from './setQueryValue';
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
