import React from 'react';
import Datasource from '../../datasource';
import { AzureMonitorQuery, AzureQueryType, AzureMonitorOption } from '../../types';
import MetricsQueryEditor from '../MetricsQueryEditor';
import QueryTypeField from './QueryTypeField';

interface BaseQueryEditorProps {
  query: AzureMonitorQuery;
  datasource: Datasource;
  onChange: (newQuery: AzureMonitorQuery) => void;
  variableOptionGroup: { label: string; options: AzureMonitorOption[] };
}

const QueryEditor: React.FC<BaseQueryEditorProps> = ({ query, datasource, onChange }) => {
  const subscriptionId = query.subscription || datasource.azureMonitorDatasource.subscriptionId;
  const variableOptionGroup = {
    label: 'Template Variables',
    options: datasource.getVariables().map((v) => ({ label: v, value: v })),
  };

  return (
    <div data-testid="azure-monitor-query-editor">
      <QueryTypeField query={query} onQueryChange={onChange} />
      <EditorForQueryType
        subscriptionId={subscriptionId}
        query={query}
        datasource={datasource}
        onChange={onChange}
        variableOptionGroup={variableOptionGroup}
      />
    </div>
  );
};

interface EditorForQueryTypeProps extends BaseQueryEditorProps {
  subscriptionId: string;
}

const EditorForQueryType: React.FC<EditorForQueryTypeProps> = ({
  subscriptionId,
  query,
  datasource,
  variableOptionGroup,
  onChange,
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
        />
      );
  }

  return null;
};

export default QueryEditor;
