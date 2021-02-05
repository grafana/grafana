import { Select } from '@grafana/ui';
import React from 'react';
import Datasource from '../datasource';
import { AzureMonitorQuery, AzureQueryType } from '../types';
import { Field } from './Field';
import MetricsQueryEditor from './MetricsQueryEditor';

interface BaseQueryEditorProps {
  query: AzureMonitorQuery;
  datasource: Datasource;
  onChange: (newQuery: AzureMonitorQuery) => void;
}

const QUERY_TYPES = [
  { value: AzureQueryType.ApplicationInsights, label: 'Application Insights' },
  { value: AzureQueryType.AzureMonitor, label: 'Metrics' },
  { value: AzureQueryType.LogAnalytics, label: 'Logs' },
  { value: AzureQueryType.InsightsAnalytics, label: 'Insights Analytics' },
];

const QueryEditor: React.FC<BaseQueryEditorProps> = ({ query, datasource, onChange }) => {
  const subscriptionId = query.subscription || datasource.azureMonitorDatasource.subscriptionId;

  return (
    <div>
      <hr />
      <Field label="Service">
        <Select options={QUERY_TYPES} onChange={() => {}} />
      </Field>
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
