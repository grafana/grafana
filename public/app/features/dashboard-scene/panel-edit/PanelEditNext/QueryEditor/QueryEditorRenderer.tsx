import { isEqual } from 'lodash';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import {
  CoreApp,
  type DataSourceApi,
  type DataSourceInstanceSettings,
  DataSourcePluginContextProvider,
  LoadingState,
  type PanelData,
} from '@grafana/data';
import { t, Trans } from '@grafana/i18n';
import { useFlagQueryeditorCoauthoringUi } from '@grafana/runtime/internal';
import { type DataQuery } from '@grafana/schema';
import { Alert, ErrorBoundaryAlert, Spinner, Stack, Text } from '@grafana/ui';
import { filterPanelDataToQuery } from 'app/features/query/components/QueryEditorRow';
import { QueryErrorAlert } from 'app/features/query/components/QueryErrorAlert';

import { QueryCoauthoringHostProvider } from './QueryCoauthoringHostContext';
import { QueryCoauthoringSurface } from './QueryCoauthoringSurface';
import { useActionsContext, useQueryEditorUIContext, useQueryRunnerContext } from './QueryEditorContext';
import {
  type InternalQueryEditorCoauthoringPropsV1,
  type QueryEditorCoauthoringAdapterV1,
  type QueryEditorCoauthoringRegistrationV1,
} from './internalCoauthoringContract';
import { type QueryPreview } from './queryPreview';

const PROMETHEUS_DATASOURCE_TYPE = 'prometheus';

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
  startQueryPreview: (originalRefId: string, proposedQuery: DataQuery) => QueryPreview | undefined;
}

interface CoauthoringPreviewTransaction {
  baseline: DataQuery;
  queryKey: string;
}

export function synchronizeCoauthoringBaselineQuery(
  currentQuery: DataQuery | null | undefined,
  baseline: DataQuery,
  updateQuery: (updatedQuery: DataQuery, originalRefId: string) => void
): boolean {
  if (!currentQuery) {
    return false;
  }

  const normalizedBaseline = { ...baseline, refId: currentQuery.refId };
  if (isEqual(currentQuery, normalizedBaseline)) {
    return true;
  }

  updateQuery(normalizedBaseline, currentQuery.refId);
  return true;
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
  startQueryPreview,
}: QueryEditorPanelProps) {
  const coauthoringEnabled = useFlagQueryeditorCoauthoringUi();
  const coauthoringIdentity = `${queryDsData?.dsSettings?.uid ?? ''}:${query?.refId ?? ''}`;
  const coauthoringDatasourceType = queryDsData?.dsSettings?.type ?? '';
  const [coauthoringAdapter, setCoauthoringAdapter] = useState<QueryEditorCoauthoringAdapterV1>();
  const queryRef = useRef(query);
  queryRef.current = query;
  const coauthoringPreviewTransactionRef = useRef<CoauthoringPreviewTransaction | undefined>(undefined);
  const coauthoringProposalRef = useRef<DataQuery | undefined>(undefined);
  const coauthoringPreviewRef = useRef<QueryPreview | undefined>(undefined);
  const runQueriesRef = useRef(runQueries);
  runQueriesRef.current = runQueries;
  const [coauthoringProposal, setCoauthoringProposal] = useState<DataQuery>();
  const [coauthoringPreviewPhase, setCoauthoringPreviewPhase] = useState<'idle' | 'pending' | 'running' | 'complete'>(
    'idle'
  );
  const error = data?.errors?.find((e) => e.refId === query?.refId);
  const queryRefId = query?.refId;
  // Filter panel data to only include data for this specific query
  const filteredData = useMemo(() => {
    return queryRefId && data ? filterPanelDataToQuery(data, queryRefId) : undefined;
  }, [data, queryRefId]);
  const coauthoringRegistration = useMemo<QueryEditorCoauthoringRegistrationV1>(
    () => ({
      register: (adapter) => {
        setCoauthoringAdapter(adapter);
        return () => setCoauthoringAdapter((current) => (current === adapter ? undefined : current));
      },
    }),
    []
  );

  const clearCoauthoringPreviewTransaction = useCallback((): CoauthoringPreviewTransaction | undefined => {
    const transaction = coauthoringPreviewTransactionRef.current;
    coauthoringPreviewRef.current?.dispose();
    coauthoringPreviewRef.current = undefined;
    coauthoringPreviewTransactionRef.current = undefined;
    coauthoringProposalRef.current = undefined;
    setCoauthoringProposal(undefined);
    setCoauthoringPreviewPhase('idle');
    return transaction;
  }, []);

  useEffect(() => {
    return () => {
      const transaction = coauthoringPreviewTransactionRef.current;
      if (!transaction || transaction.queryKey !== coauthoringIdentity) {
        return;
      }
      clearCoauthoringPreviewTransaction();
      runQueriesRef.current();
    };
  }, [clearCoauthoringPreviewTransaction, coauthoringIdentity]);

  // Key off updatedQuery.refId so late onChange calls (e.g. editor unmount cleanup) hit the right query.
  const handleChange = useCallback(
    (updatedQuery: DataQuery) => {
      const proposal = coauthoringProposalRef.current;
      if (proposal?.refId === updatedQuery.refId) {
        if (isEqual(proposal, updatedQuery)) {
          return;
        }
        const originalRefId = clearCoauthoringPreviewTransaction()?.baseline.refId ?? updatedQuery.refId;
        coauthoringAdapter?.dismiss();
        updateQuery(updatedQuery, originalRefId);
        return;
      }
      updateQuery(updatedQuery, updatedQuery.refId);
    },
    [clearCoauthoringPreviewTransaction, coauthoringAdapter, updateQuery]
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
      coauthoringPreviewRef.current?.dispose();
      coauthoringPreviewRef.current = undefined;
      const preview = startQueryPreview(baseline.refId, proposedQuery);
      if (!preview) {
        clearCoauthoringPreviewTransaction();
        if (transaction) {
          runQueriesRef.current();
        }
        return false;
      }
      coauthoringPreviewTransactionRef.current = transaction ?? {
        baseline,
        queryKey: coauthoringIdentity,
      };
      coauthoringPreviewRef.current = preview;
      coauthoringProposalRef.current = proposedQuery;
      setCoauthoringProposal(proposedQuery);
      setCoauthoringPreviewPhase('pending');
      preview.subscribeToState((state) => {
        if (coauthoringPreviewRef.current === preview) {
          setCoauthoringPreviewPhase(state === LoadingState.Loading ? 'running' : 'complete');
        }
      });
      return true;
    },
    [clearCoauthoringPreviewTransaction, coauthoringIdentity, startQueryPreview]
  );

  const revertCoauthoredQueryPreview = useCallback(() => {
    const transaction = clearCoauthoringPreviewTransaction();
    if (!transaction) {
      return;
    }
    runQueries();
  }, [clearCoauthoringPreviewTransaction, runQueries]);

  const runQueryWithCoauthoringSafety = useCallback(() => {
    if (clearCoauthoringPreviewTransaction()) {
      coauthoringAdapter?.dismiss();
    }
    runQueries();
  }, [clearCoauthoringPreviewTransaction, coauthoringAdapter, runQueries]);

  const acceptCoauthoredQuery = useCallback(
    (acceptedQuery: DataQuery): boolean => {
      const transaction = coauthoringPreviewTransactionRef.current;
      if (!transaction || transaction.queryKey !== coauthoringIdentity) {
        return false;
      }

      clearCoauthoringPreviewTransaction();
      updateQuery(acceptedQuery, transaction.baseline.refId);
      runQueries();
      return true;
    },
    [clearCoauthoringPreviewTransaction, coauthoringIdentity, runQueries, updateQuery]
  );

  const synchronizeCoauthoringBaseline = useCallback(
    (baseline: DataQuery): boolean => {
      return synchronizeCoauthoringBaselineQuery(queryRef.current, baseline, updateQuery);
    },
    [updateQuery]
  );

  const coauthoringHost = useMemo(
    () => ({
      datasourceType: coauthoringDatasourceType,
      previewPhase: coauthoringPreviewPhase,
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
      coauthoringPreviewPhase,
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
  const internalCoauthoringProps: InternalQueryEditorCoauthoringPropsV1 = {
    unstable_queryEditorCoauthoringV1:
      coauthoringEnabled && coauthoringDatasourceType === PROMETHEUS_DATASOURCE_TYPE
        ? coauthoringRegistration
        : undefined,
  };
  const editorQuery = coauthoringProposal?.refId === query.refId ? coauthoringProposal : query;
  const editorQueries = coauthoringProposal
    ? queries.map((candidate) => (candidate.refId === coauthoringProposal.refId ? coauthoringProposal : candidate))
    : queries;

  return (
    <>
      <QueryCoauthoringHostProvider value={coauthoringHost}>
        <DataSourcePluginContextProvider instanceSettings={dsSettings}>
          <ErrorBoundaryAlert boundaryName="query-editor-renderer">
            <QueryEditorComponent
              key={coauthoringIdentity}
              {...internalCoauthoringProps}
              app={CoreApp.PanelEditor}
              data={filteredData}
              datasource={datasource}
              onAddQuery={addQuery}
              onChange={handleChange}
              onRunQuery={runQueryWithCoauthoringSafety}
              queries={editorQueries}
              query={editorQuery}
              range={filteredData?.timeRange}
            />
            {coauthoringAdapter && (
              <QueryCoauthoringSurface adapter={coauthoringAdapter} onBaseline={synchronizeCoauthoringBaseline} />
            )}
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
  const { updateSelectedQuery, addQuery, runQueries, startQueryPreview } = useActionsContext();

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
      startQueryPreview={startQueryPreview}
    />
  );
}
