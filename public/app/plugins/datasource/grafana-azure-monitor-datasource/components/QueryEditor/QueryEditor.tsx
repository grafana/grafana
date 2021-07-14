import { Alert } from '@grafana/ui';
import { QueryEditorProps } from '@grafana/data';
import React from 'react';
import AzureMonitorDatasource from '../../datasource';
import {
  AzureMonitorQuery,
  AzureQueryType,
  AzureMonitorOption,
  AzureMonitorErrorish,
  AzureDataSourceJsonData,
} from '../../types';
import MetricsQueryEditor from '../MetricsQueryEditor';
import QueryTypeField from './QueryTypeField';
import useLastError from '../../utils/useLastError';
import LogsQueryEditor from '../LogsQueryEditor';
import ArgQueryEditor from '../ArgQueryEditor';
import ApplicationInsightsEditor from '../ApplicationInsightsEditor';
import InsightsAnalyticsEditor from '../InsightsAnalyticsEditor';
import { Space } from '../Space';

export type AzureMonitorQueryEditorProps = QueryEditorProps<
  AzureMonitorDatasource,
  AzureMonitorQuery,
  AzureDataSourceJsonData
>;

const QueryEditor: React.FC<AzureMonitorQueryEditorProps> = ({ query, datasource, onChange }) => {
  const [errorMessage, setError] = useLastError();
  const subscriptionId = query.subscription || datasource.azureMonitorDatasource.defaultSubscriptionId;
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
        setError={setError}
      />

      {errorMessage && (
        <>
          <Space v={2} />
          <Alert severity="error" title="An error occurred while requesting metadata from Azure Monitor">
            {errorMessage}
          </Alert>
        </>
      )}
    </div>
  );
};

interface EditorForQueryTypeProps extends Omit<AzureMonitorQueryEditorProps, 'onRunQuery'> {
  subscriptionId?: string;
  variableOptionGroup: { label: string; options: AzureMonitorOption[] };
  setError: (source: string, error: AzureMonitorErrorish | undefined) => void;
}

const EditorForQueryType: React.FC<EditorForQueryTypeProps> = ({
  subscriptionId,
  query,
  datasource,
  variableOptionGroup,
  onChange,
  setError,
}) => {
  switch (query.queryType) {
    case undefined:
    case AzureQueryType.AzureMonitor:
      return (
        <MetricsQueryEditor
          subscriptionId={subscriptionId}
          query={query}
          datasource={datasource}
          onChange={onChange}
          variableOptionGroup={variableOptionGroup}
          setError={setError}
        />
      );

    case AzureQueryType.LogAnalytics:
      return (
        <LogsQueryEditor
          subscriptionId={subscriptionId}
          query={query}
          datasource={datasource}
          onChange={onChange}
          variableOptionGroup={variableOptionGroup}
          setError={setError}
        />
      );

    case AzureQueryType.ApplicationInsights:
      return <ApplicationInsightsEditor query={query} />;

    case AzureQueryType.InsightsAnalytics:
      return <InsightsAnalyticsEditor query={query} />;

    case AzureQueryType.AzureResourceGraph:
      return (
        <ArgQueryEditor
          subscriptionId={subscriptionId}
          query={query}
          datasource={datasource}
          onChange={onChange}
          variableOptionGroup={variableOptionGroup}
          setError={setError}
        />
      );
  }

  return null;
};

export default QueryEditor;
