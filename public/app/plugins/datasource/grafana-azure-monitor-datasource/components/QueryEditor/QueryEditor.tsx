import { debounce } from 'lodash';
import React, { useCallback, useMemo } from 'react';

import { QueryEditorProps } from '@grafana/data';
import { Alert, CodeEditor } from '@grafana/ui';

import AzureMonitorDatasource from '../../datasource';
import {
  AzureDataSourceJsonData,
  AzureMonitorErrorish,
  AzureMonitorOption,
  AzureMonitorQuery,
  AzureQueryType,
} from '../../types';
import useLastError from '../../utils/useLastError';
import ArgQueryEditor from '../ArgQueryEditor';
import LogsQueryEditor from '../LogsQueryEditor';
import NewMetricsQueryEditor from '../MetricsQueryEditor/MetricsQueryEditor';
import { QueryHeader } from '../QueryHeader';
import { Space } from '../Space';

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
      <QueryHeader query={query} onQueryChange={onQueryChange} />

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
      return (
        <NewMetricsQueryEditor
          data={data}
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

    default:
      const type = query.queryType as unknown;
      return (
        <Alert title="Unknown query type">
          {(type === 'Application Insights' || type === 'Insights Analytics') && (
            <>
              {type} was deprecated in Grafana 9. See the{' '}
              <a
                href="https://grafana.com/docs/grafana/latest/datasources/azuremonitor/deprecated-application-insights/"
                target="_blank"
                rel="noreferrer"
              >
                deprecation notice
              </a>{' '}
              to get more information about how to migrate your queries. This is the current query definition:
              <CodeEditor height="200px" readOnly language="json" value={JSON.stringify(query, null, 4)} />
            </>
          )}
        </Alert>
      );
  }
};

export default QueryEditor;
