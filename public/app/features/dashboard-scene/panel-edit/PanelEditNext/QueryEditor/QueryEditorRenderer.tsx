import { useCallback, useMemo, useRef } from 'react';

import { CoreApp, DataSourcePluginContextProvider } from '@grafana/data';
import { t, Trans } from '@grafana/i18n';
import { DataQuery } from '@grafana/schema';
import { Alert, Spinner, Stack, Text } from '@grafana/ui';
import { filterPanelDataToQuery } from 'app/features/query/components/QueryEditorRow';
import { QueryErrorAlert } from 'app/features/query/components/QueryErrorAlert';

import { useActionsContext, useQueryEditorUIContext, useQueryRunnerContext } from './QueryEditorContext';

export function QueryEditorRenderer() {
  const { queries, data, queryError } = useQueryRunnerContext();
  const { selectedQuery, selectedQueryDsData, selectedQueryDsLoading } = useQueryEditorUIContext();
  const { updateSelectedQuery, addQuery, runQueries } = useActionsContext();

  const selectedRefId = selectedQuery?.refId;

  // Ref updated during render (not in an effect) so handleChange can detect
  // and discard stale onChange calls from downstream editors on query switch.
  const selectedRefIdRef = useRef(selectedRefId);
  selectedRefIdRef.current = selectedRefId;

  // Filter panel data to only include data for this specific query
  const filteredData = useMemo(() => {
    return selectedRefId && data ? filterPanelDataToQuery(data, selectedRefId) : undefined;
  }, [data, selectedRefId]);

  const handleChange = useCallback(
    (updatedQuery: DataQuery) => {
      const currentRefId = selectedRefIdRef.current;
      if (!currentRefId) {
        return;
      }
      // Discard stale onChange calls targeting a previously selected query.
      if (updatedQuery.refId !== currentRefId) {
        return;
      }
      updateSelectedQuery(updatedQuery, currentRefId);
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
      {queryError && <QueryErrorAlert error={queryError} />}
    </>
  );
}
