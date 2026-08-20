import { isEqual } from 'lodash';
import { useCallback, useMemo, useRef, useState } from 'react';

import {
  CoreApp,
  type DataSourceApi,
  type DataSourceInstanceSettings,
  DataSourcePluginContextProvider,
  type PanelData,
} from '@grafana/data';
import { t, Trans } from '@grafana/i18n';
import { useFlagQueryeditorCoauthoringUi } from '@grafana/runtime/internal';
import { type DataQuery } from '@grafana/schema';
import { Alert, ErrorBoundaryAlert, Spinner, Stack, Text } from '@grafana/ui';
import { filterPanelDataToQuery } from 'app/features/query/components/QueryEditorRow';
import { QueryErrorAlert } from 'app/features/query/components/QueryErrorAlert';

import { QueryCoauthoringHostProvider } from './QueryCoauthoringHostContext';
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

interface CoauthoringPreviewTransaction {
  baseline: DataQuery;
  queryKey: string;
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
  const coauthoringEnabled = useFlagQueryeditorCoauthoringUi();
  const coauthoringIdentity = `${queryDsData?.dsSettings?.uid ?? ''}:${query?.refId ?? ''}`;
  const coauthoringDatasourceType = queryDsData?.dsSettings?.type ?? '';
  const queryRef = useRef(query);
  queryRef.current = query;
  const coauthoringBaselineRef = useRef<DataQuery | undefined>(undefined);
  const coauthoringPreviewTransactionRef = useRef<CoauthoringPreviewTransaction | undefined>(undefined);
  const [coauthoringBaseline, setCoauthoringBaseline] = useState<DataQuery>();
  const error = data?.errors?.find((e) => e.refId === query?.refId);
  const queryRefId = query?.refId;
  // Filter panel data to only include data for this specific query
  const filteredData = useMemo(() => {
    return queryRefId && data ? filterPanelDataToQuery(data, queryRefId) : undefined;
  }, [data, queryRefId]);

  // Key off updatedQuery.refId so late onChange calls (e.g. editor unmount cleanup) hit the right query.
  const handleChange = useCallback(
    (updatedQuery: DataQuery) => {
      const coauthoringBaseline = coauthoringBaselineRef.current;
      if (coauthoringBaseline?.refId === updatedQuery.refId) {
        if (isEqual(coauthoringBaseline, updatedQuery)) {
          return;
        }
        coauthoringBaselineRef.current = updatedQuery;
        coauthoringPreviewTransactionRef.current = undefined;
        setCoauthoringBaseline(updatedQuery);
        return;
      }
      updateQuery(updatedQuery, updatedQuery.refId);
    },
    [updateQuery]
  );

  const previewCoauthoredQuery = useCallback(
    (proposedQuery: DataQuery): boolean => {
      const currentQuery = queryRef.current;
      if (!currentQuery) {
        return false;
      }

      const transaction = coauthoringPreviewTransactionRef.current;
      if (transaction && transaction.queryKey !== coauthoringIdentity) {
        return false;
      }

      const baseline = transaction?.baseline ?? currentQuery;
      coauthoringPreviewTransactionRef.current = transaction ?? {
        baseline,
        queryKey: coauthoringIdentity,
      };
      coauthoringBaselineRef.current = baseline;
      setCoauthoringBaseline(baseline);
      updateQuery(proposedQuery, baseline.refId);
      runQueries();
      return true;
    },
    [coauthoringIdentity, runQueries, updateQuery]
  );

  const revertCoauthoredQueryPreview = useCallback(() => {
    const baseline = coauthoringBaselineRef.current;
    if (!baseline) {
      return;
    }

    coauthoringBaselineRef.current = undefined;
    coauthoringPreviewTransactionRef.current = undefined;
    setCoauthoringBaseline(undefined);
    updateQuery(baseline, baseline.refId);
    runQueries();
  }, [runQueries, updateQuery]);

  const runQueryWithCoauthoringSafety = useCallback(() => {
    const baseline = coauthoringBaselineRef.current;
    if (baseline) {
      coauthoringBaselineRef.current = undefined;
      coauthoringPreviewTransactionRef.current = undefined;
      setCoauthoringBaseline(undefined);
      updateQuery(baseline, baseline.refId);
    }
    runQueries();
  }, [runQueries, updateQuery]);

  const acceptCoauthoredQuery = useCallback(
    (acceptedQuery: DataQuery): boolean => {
      const transaction = coauthoringPreviewTransactionRef.current;
      if (!transaction || transaction.queryKey !== coauthoringIdentity) {
        return false;
      }

      coauthoringPreviewTransactionRef.current = undefined;
      coauthoringBaselineRef.current = undefined;
      setCoauthoringBaseline(undefined);
      updateQuery(acceptedQuery, acceptedQuery.refId);
      return true;
    },
    [coauthoringIdentity, updateQuery]
  );

  const coauthoringHost = useMemo(
    () => ({
      datasourceType: coauthoringDatasourceType,
      timeRange: filteredData?.timeRange
        ? { from: filteredData.timeRange.from.valueOf(), to: filteredData.timeRange.to.valueOf() }
        : undefined,
      preview: previewCoauthoredQuery,
      accept: acceptCoauthoredQuery,
      revert: revertCoauthoredQueryPreview,
    }),
    [
      acceptCoauthoredQuery,
      coauthoringDatasourceType,
      filteredData?.timeRange,
      previewCoauthoredQuery,
      revertCoauthoredQueryPreview,
    ]
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
  const editorQuery = coauthoringBaseline?.refId === query.refId ? coauthoringBaseline : query;
  const editorQueries = coauthoringBaseline
    ? queries.map((candidate) => (candidate.refId === coauthoringBaseline.refId ? coauthoringBaseline : candidate))
    : queries;

  return (
    <>
      <QueryCoauthoringHostProvider value={coauthoringHost}>
        <DataSourcePluginContextProvider instanceSettings={dsSettings}>
          <ErrorBoundaryAlert boundaryName="query-editor-renderer">
            <QueryEditorComponent
              key={coauthoringIdentity}
              app={CoreApp.PanelEditor}
              data={filteredData}
              datasource={datasource}
              onAddQuery={addQuery}
              onChange={handleChange}
              onRunQuery={runQueryWithCoauthoringSafety}
              queries={editorQueries}
              query={editorQuery}
              range={filteredData?.timeRange}
              queryEditorCoauthoringEnabled={coauthoringEnabled}
            />
          </ErrorBoundaryAlert>
        </DataSourcePluginContextProvider>
      </QueryCoauthoringHostProvider>
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
