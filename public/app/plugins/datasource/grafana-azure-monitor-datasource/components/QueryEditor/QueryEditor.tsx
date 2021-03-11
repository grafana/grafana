import { Alert, VerticalGroup } from '@grafana/ui';
import React, { useCallback, useState } from 'react';
import Datasource from '../../datasource';
import { AzureMonitorQuery, AzureQueryType, AzureMonitorOption } from '../../types';
import MetricsQueryEditor from '../MetricsQueryEditor';
import { messageFromError } from './messageFromError';
import QueryTypeField from './QueryTypeField';

interface BaseQueryEditorProps {
  query: AzureMonitorQuery;
  datasource: Datasource;
  onChange: (newQuery: AzureMonitorQuery) => void;
  variableOptionGroup: { label: string; options: AzureMonitorOption[] };
}

const QueryEditor: React.FC<BaseQueryEditorProps> = ({ query, datasource, onChange }) => {
  const [error, setError] = useState<{ message: string | undefined } | undefined>();

  const subscriptionId = query.subscription || datasource.azureMonitorDatasource.subscriptionId;
  const variableOptionGroup = {
    label: 'Template Variables',
    options: datasource.getVariables().map((v) => ({ label: v, value: v })),
  };

  // Handles errors from any child components that request data to display their options
  const handleError = useCallback((err: unknown) => {
    console.error('Error from child', err);
    const msg = messageFromError(err);
    console.log(msg);
    setError({ message: msg });
  }, []);

  return (
    <div data-testid="azure-monitor-query-editor">
      <p>
        {`The Resource 'Microsoft.Compute/virtualMachines/grafanadev' under resource group 'grafanadev' was not found.
      For more details please go to https://aka.ms/ARMResourceNotFoundFix The Resource
      'Microsoft.Compute/virtualMachines/grafanadev' under resource group 'grafanadev' was not found. For more
      details please go to https://aka.ms/ARMResourceNotFoundFix`}
      </p>

      <VerticalGroup>
        <div>
          <QueryTypeField query={query} onQueryChange={onChange} />
          <EditorForQueryType
            subscriptionId={subscriptionId}
            query={query}
            datasource={datasource}
            onChange={onChange}
            variableOptionGroup={variableOptionGroup}
            onError={handleError}
          />
        </div>

        {error && (
          <Alert severity="error" title="An error occurred while requesting data from Azure Monitor">
            {error.message}
          </Alert>
        )}
      </VerticalGroup>
    </div>
  );
};

interface EditorForQueryTypeProps extends BaseQueryEditorProps {
  subscriptionId: string;
  onError: (err: Error) => void;
}

const EditorForQueryType: React.FC<EditorForQueryTypeProps> = ({
  subscriptionId,
  query,
  datasource,
  variableOptionGroup,
  onChange,
  onError,
}) => {
  switch (query.queryType) {
    case AzureQueryType.AzureMonitor:
      return (
        <MetricsQueryEditor
          subscriptionId={subscriptionId}
          query={query}
          datasource={datasource}
          onChange={onChange}
          variableOptionGroup={variableOptionGroup}
          onError={onError}
        />
      );
  }

  return null;
};

export default QueryEditor;
