import { debounce } from 'lodash';
import React, { useCallback, useMemo } from 'react';

import { QueryEditorProps } from '@grafana/data';
import { config } from '@grafana/runtime';
import { Alert } from '@grafana/ui';

import AzureMonitorDatasource from '../../datasource';
import {
  AzureDataSourceJsonData,
  AzureMonitorErrorish,
  AzureMonitorOption,
  AzureMonitorQuery,
  AzureQueryType,
  DeprecatedAzureQueryType,
} from '../../types';
import useLastError from '../../utils/useLastError';
import ArgQueryEditor from '../ArgQueryEditor';
import LogsQueryEditor from '../LogsQueryEditor';
import MetricsQueryEditor from '../MetricsQueryEditor';
import NewMetricsQueryEditor from '../NewMetricsQueryEditor/MetricsQueryEditor';
import { Space } from '../Space';
import ApplicationInsightsEditor from '../deprecated/components/ApplicationInsightsEditor';
import InsightsAnalyticsEditor from '../deprecated/components/InsightsAnalyticsEditor';
import { gtGrafana9 } from '../deprecated/utils';

import QueryTypeField from './QueryTypeField';
import usePreparedQuery from './usePreparedQuery';

export type AzureMonitorQueryEditorProps = QueryEditorProps<
  AzureMonitorDatasource,
  AzureMonitorQuery,
  AzureDataSourceJsonData
>;

const QueryEditor: React.FC<AzureMonitorQueryEditorProps> = ({
  query: baseQuery,
  datasource,
  onChange,
  onRunQuery: baseOnRunQuery,
  data,
}) => {
  const [errorMessage, setError] = useLastError();
  const onRunQuery = useMemo(() => debounce(baseOnRunQuery, 500), [baseOnRunQuery]);

  const onQueryChange = useCallback(
    (newQuery: AzureMonitorQuery) => {
      onChange(newQuery);
      onRunQuery();
    },
    [onChange, onRunQuery]
  );

  const query = usePreparedQuery(baseQuery, onQueryChange);

  const subscriptionId = query.subscription || datasource.azureMonitorDatasource.defaultSubscriptionId;
  const variableOptionGroup = {
    label: 'Template Variables',
    options: datasource.getVariables().map((v) => ({ label: v, value: v })),
  };

  return (
    <div data-testid="azure-monitor-query-editor">
      <QueryTypeField query={query} onQueryChange={onQueryChange} />

      <EditorForQueryType
        data={data}
        subscriptionId={subscriptionId}
        query={query}
        datasource={datasource}
        onChange={onQueryChange}
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
  data,
  subscriptionId,
  query,
  datasource,
  variableOptionGroup,
  onChange,
  setError,
}) => {
  switch (query.queryType) {
    case AzureQueryType.AzureMonitor:
      if (config.featureToggles.azureMonitorResourcePickerForMetrics) {
        return <NewMetricsQueryEditor />;
      }
      return (
        <MetricsQueryEditor
          data={data}
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

    /** Remove with Grafana 9 */
    case DeprecatedAzureQueryType.ApplicationInsights:
      if (gtGrafana9()) {
        return (
          <Alert title="Deprecated">
            Application Insights has been deprecated.{' '}
            <a
              href="https://grafana.com/docs/grafana/latest/datasources/azuremonitor/deprecated-application-insights/#application-insights"
              target="_blank"
              rel="noreferrer"
            >
              Use the Metrics service instead
            </a>
            .
          </Alert>
        );
      }
      return <ApplicationInsightsEditor query={query} />;

    case DeprecatedAzureQueryType.InsightsAnalytics:
      if (gtGrafana9()) {
        return (
          <Alert title="Deprecated">
            Insight Analytics has been deprecated.{' '}
            <a
              href="https://grafana.com/docs/grafana/latest/datasources/azuremonitor/deprecated-application-insights/#insights-analytics"
              target="_blank"
              rel="noreferrer"
            >
              Queries can be written with Kusto in the Logs query type by selecting your Application Insights resource
            </a>
            .
          </Alert>
        );
      }
      return <InsightsAnalyticsEditor query={query} />;
    /** ===================== */

    default:
      return <Alert title="Unknown query type" />;
  }

  return null;
};

export default QueryEditor;
