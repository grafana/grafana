import React from 'react';
import Datasource from '../datasource';
import { AzureMonitorQuery, AzureQueryType } from '../types';
import MetricsQueryEditor from './MetricsQueryEditor';

interface BaseQueryEditorProps {
  query: AzureMonitorQuery;
  datasource: Datasource;
  onChange: (newQuery: AzureMonitorQuery) => void;
}

const QueryEditor: React.FC<BaseQueryEditorProps> = ({ query, datasource, onChange }) => {
  const subscriptionId = query.subscription || datasource.azureMonitorDatasource.subscriptionId;

  return (
    <div>
      <hr />
      <EditorForQueryType subscriptionId={subscriptionId} query={query} datasource={datasource} onChange={onChange} />
    </div>
  );
};

interface EditorForQueryTypeProps extends BaseQueryEditorProps {
  subscriptionId: string;
}

const EditorForQueryType: React.FC<EditorForQueryTypeProps> = ({ subscriptionId, query, datasource, onChange }) => {
  switch (query.queryType) {
    case AzureQueryType.AzureMonitor:
      return (
        <MetricsQueryEditor subscriptionId={subscriptionId} query={query} datasource={datasource} onChange={onChange} />
      );
  }

  return null;
};

export default QueryEditor;
