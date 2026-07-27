import { useCallback, useMemo } from 'react';

import {
  CoreApp,
  type DataSourceApi,
  type DataSourceInstanceSettings,
  DataSourcePluginContextProvider,
  type PanelData,
} from '@grafana/data';
import { t, Trans } from '@grafana/i18n';
import { type DataQuery } from '@grafana/schema';
import { Alert, ErrorBoundaryAlert, Spinner, Stack, Text } from '@grafana/ui';
import { filterPanelDataToQuery } from 'app/features/query/components/QueryEditorRow';
import { QueryErrorAlert } from 'app/features/query/components/QueryErrorAlert';

import { useActionsContext, useQueryEditorUIContext, useQueryRunnerContext } from './QueryEditorContext';

interface QueryDatasourceData {
  datasource?: DataSourceApi;
  dsSettings?: DataSourceInstanceSettings;
}

interface QueryEditorPanelProps {
  query: DataQuery | null;
  queryDsData: QueryDatasourceData | null;
  queryDsLoading: boolean;
  queries: DataQuery[];
  data?: PanelData;
  updateQuery: (updatedQuery: DataQuery, originalRefId: string) => void;
  addQuery: (query?: Partial<DataQuery>, afterRefId?: string) => string | undefined;
  runQueries: () => void;
}

export function QueryEditorPanel({
  query,
  queryDsData,
  queryDsLoading,
  queries,
  data,
  updateQuery,
  addQuery,
  runQueries,
}: QueryEditorPanelProps) {
  const error = data?.errors?.find((e) => e.refId === query?.refId);
  const queryRefId = query?.refId;
  // Filter panel data to only include data for this specific query
  const filteredData = useMemo(() => {
    return queryRefId && data ? filterPanelDataToQuery(data, queryRefId) : undefined;
  }, [data, queryRefId]);

  // Key off updatedQuery.refId so late onChange calls (e.g. editor unmount cleanup) hit the right query.
  const handleChange = useCallback(
    (updatedQuery: DataQuery) => {
      updateQuery(updatedQuery, updatedQuery.refId);
    },
    [updateQuery]
  );

  if (!query) {
    return null;
  }

  if (queryDsLoading) {
    return (
      <Stack gap={1}>
        <Spinner />
        <Text>
          <Trans i18nKey="query-editor-renderer.loading-datasource">Loading datasource</Trans>
        </Text>
      </Stack>
    );
  }

  if (!queryDsData?.datasource || !queryDsData?.dsSettings) {
    return (
      <Alert
        severity="error"
        title={t('query-editor-renderer.datasource-load-error-title', 'Failed to load datasource for this query')}
      >
        {t('query-editor-renderer.datasource-load-error-body', 'Select a datasource for this query to continue.')}
      </Alert>
    );
  }

  const QueryEditorComponent = queryDsData.datasource.components?.QueryEditor;

  if (!QueryEditorComponent) {
    return (
      <Alert
        severity="warning"
        title={t(
          'query-editor-renderer.no-query-editor-component',
          'Data source plugin does not export any query editor component'
        )}
      />
    );
  }

  const { datasource, dsSettings } = queryDsData;

  return (
    <>
      <DataSourcePluginContextProvider instanceSettings={dsSettings}>
        <ErrorBoundaryAlert boundaryName="query-editor-renderer">
          <QueryEditorComponent
            key={query.refId}
            app={CoreApp.PanelEditor}
            data={filteredData}
            datasource={datasource}
            onAddQuery={addQuery}
            onChange={handleChange}
            onRunQuery={runQueries}
            queries={queries}
            query={query}
            range={filteredData?.timeRange}
          />
        </ErrorBoundaryAlert>
      </DataSourcePluginContextProvider>
      {error && <QueryErrorAlert error={error} />}
    </>
  );
}

export function QueryEditorRenderer() {
  const { queries, data } = useQueryRunnerContext();
  const { selectedQuery, selectedQueryDsData, selectedQueryDsLoading } = useQueryEditorUIContext();
  const { updateSelectedQuery, addQuery, runQueries } = useActionsContext();

  return (
    <QueryEditorPanel
      query={selectedQuery}
      queryDsData={selectedQueryDsData}
      queryDsLoading={selectedQueryDsLoading}
      queries={queries}
      data={data}
      updateQuery={updateSelectedQuery}
      addQuery={addQuery}
      runQueries={runQueries}
    />
  );
}
