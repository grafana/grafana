import React from 'react';
import Datasource from '../datasource';
import { AzureMonitorQuery, AzureQueryType } from '../types';
import MetricsQueryEditor from './MetricsQueryEditor';

interface BaseQueryEditorProps {
  query: AzureMonitorQuery;
  datasource: Datasource;
  replaceTemplateVariable: (variable: string) => string;
  onQueryChange: (newQuery: AzureMonitorQuery) => void;
}

const QueryEditor: React.FC<BaseQueryEditorProps> = ({ query, datasource, replaceTemplateVariable, onQueryChange }) => {
  const subscriptionId = query.subscription || datasource.azureMonitorDatasource.subscriptionId;

  return (
    <div>
      <hr />
      <EditorForQueryType
        subscriptionId={subscriptionId}
        query={query}
        datasource={datasource}
        replaceTemplateVariable={replaceTemplateVariable}
        onQueryChange={onQueryChange}
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
  replaceTemplateVariable,
  onQueryChange,
}) => {
  switch (query.queryType) {
    case AzureQueryType.AzureMonitor:
      return (
        <MetricsQueryEditor
          subscriptionId={subscriptionId}
          query={query}
          datasource={datasource}
          replaceTemplateVariable={replaceTemplateVariable}
          onQueryChange={onQueryChange}
        />
      );
  }

  return null;
};

export default QueryEditor;
