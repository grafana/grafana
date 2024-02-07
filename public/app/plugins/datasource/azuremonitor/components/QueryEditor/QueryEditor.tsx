import { css } from '@emotion/css';
import { debounce } from 'lodash';
import React, { useCallback, useMemo, useState } from 'react';

import { QueryEditorProps } from '@grafana/data';
import { reportInteraction } from '@grafana/runtime';
import { Alert, Button, CodeEditor, Space } from '@grafana/ui';

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
import { AzureCheatSheetModal } from '../LogsQueryEditor/AzureCheatSheetModal';
import NewMetricsQueryEditor from '../MetricsQueryEditor/MetricsQueryEditor';
import { QueryHeader } from '../QueryHeader';
import TracesQueryEditor from '../TracesQueryEditor';

import usePreparedQuery from './usePreparedQuery';

export type AzureMonitorQueryEditorProps = QueryEditorProps<
  AzureMonitorDatasource,
  AzureMonitorQuery,
  AzureDataSourceJsonData
>;

const QueryEditor = ({
  query: baseQuery,
  datasource,
  onChange,
  onRunQuery: baseOnRunQuery,
  data,
  range,
}: AzureMonitorQueryEditorProps) => {
  const [errorMessage, setError] = useLastError();
  const onRunQuery = useMemo(() => debounce(baseOnRunQuery, 500), [baseOnRunQuery]);
  const [azureLogsCheatSheetModalOpen, setAzureLogsCheatSheetModalOpen] = useState(false);

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
      <AzureCheatSheetModal
        datasource={datasource.azureLogAnalyticsDatasource}
        isOpen={azureLogsCheatSheetModalOpen}
        onClose={() => setAzureLogsCheatSheetModalOpen(false)}
        onChange={(a) => onChange({ ...a, queryType: AzureQueryType.LogAnalytics })}
      />
      <div className={css({ display: 'flex', alignItems: 'center' })}>
        <QueryHeader query={query} onQueryChange={onQueryChange} />
        {query.queryType === AzureQueryType.LogAnalytics && (
          <Button
            aria-label="Azure logs kick start your query button"
            variant="secondary"
            size="sm"
            onClick={() => {
              setAzureLogsCheatSheetModalOpen((prevValue) => !prevValue);

              reportInteraction('grafana_azure_logs_query_patterns_opened', {
                version: 'v2',
                editorMode: query.azureLogAnalytics,
              });
            }}
          >
            Kick start your query
          </Button>
        )}
      </div>
      <EditorForQueryType
        data={data}
        subscriptionId={subscriptionId}
        query={query}
        datasource={datasource}
        onChange={onQueryChange}
        variableOptionGroup={variableOptionGroup}
        setError={setError}
        range={range}
      />

      {errorMessage && (
        <>
          <Space v={2} />
          <Alert severity="error" title="An error occurred while requesting metadata from Azure Monitor">
            {errorMessage instanceof Error ? errorMessage.message : errorMessage}
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

const EditorForQueryType = ({
  data,
  subscriptionId,
  query,
  datasource,
  variableOptionGroup,
  onChange,
  setError,
  range,
}: EditorForQueryTypeProps) => {
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
          data={data}
          subscriptionId={subscriptionId}
          query={query}
          datasource={datasource}
          onChange={onChange}
          variableOptionGroup={variableOptionGroup}
          setError={setError}
          timeRange={range}
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

    case AzureQueryType.AzureTraces:
      return (
        <TracesQueryEditor
          subscriptionId={subscriptionId}
          query={query}
          datasource={datasource}
          onChange={onChange}
          variableOptionGroup={variableOptionGroup}
          setError={setError}
          range={range}
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
