import { useCallback, useMemo } from 'react';

import { DataSourcePluginContextProvider } from '@grafana/data/context';
import { CoreApp } from '@grafana/data/types';
import { t, Trans } from '@grafana/i18n';
import { type DataQuery } from '@grafana/schema';
import { Alert, Spinner, Stack, Text } from '@grafana/ui';
import { filterPanelDataToQuery } from 'app/features/query/components/QueryEditorRow';
import { QueryErrorAlert } from 'app/features/query/components/QueryErrorAlert';

import { useActionsContext, useQueryEditorUIContext, useQueryRunnerContext } from './QueryEditorContext';

export function QueryEditorRenderer() {
  const { queries, data } = useQueryRunnerContext();
  const { selectedQuery, selectedQueryDsData, selectedQueryDsLoading } = useQueryEditorUIContext();
  const { updateSelectedQuery, addQuery, runQueries } = useActionsContext();
  const error = data?.errors?.find((e) => e.refId === selectedQuery?.refId);

  const selectedRefId = selectedQuery?.refId;

  // Filter panel data to only include data for this specific query
  const filteredData = useMemo(() => {
    return selectedRefId && data ? filterPanelDataToQuery(data, selectedRefId) : undefined;
  }, [data, selectedRefId]);

  // Key off updatedQuery.refId so late onChange calls (e.g. editor unmount cleanup) hit the right query.
  const handleChange = useCallback(
    (updatedQuery: DataQuery) => {
      updateSelectedQuery(updatedQuery, updatedQuery.refId);
    },
    [updateSelectedQuery]
  );

  if (!selectedQuery) {
    return null;
  }

  if (selectedQueryDsLoading) {
    return (
      <Stack gap={1}>
        <Spinner />
        <Text>
          <Trans i18nKey="query-editor-renderer.loading-datasource">Loading datasource</Trans>
        </Text>
      </Stack>
    );
  }

  if (!selectedQueryDsData?.datasource || !selectedQueryDsData?.dsSettings) {
    return (
      <Alert
        severity="error"
        title={t('query-editor-renderer.datasource-load-error-title', 'Failed to load datasource for this query')}
      />
    );
  }

  const QueryEditorComponent = selectedQueryDsData.datasource.components?.QueryEditor;

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

  const { datasource, dsSettings } = selectedQueryDsData;

  return (
    <>
      <DataSourcePluginContextProvider instanceSettings={dsSettings}>
        <QueryEditorComponent
          key={selectedQuery.refId}
          app={CoreApp.Dashboard}
          data={filteredData}
          datasource={datasource}
          onAddQuery={addQuery}
          onChange={handleChange}
          onRunQuery={runQueries}
          queries={queries}
          query={selectedQuery}
          range={filteredData?.timeRange}
        />
      </DataSourcePluginContextProvider>
      {error && <QueryErrorAlert error={error} />}
    </>
  );
}
