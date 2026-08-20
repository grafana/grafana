import { useCallback, useMemo, useRef, useState } from 'react';

import {
  CoreApp,
  type DataSourceApi,
  type DataSourceInstanceSettings,
  DataSourcePluginContextProvider,
  type PanelData,
  type QueryEditorCoauthoringCapability,
  QUERY_EDITOR_COAUTHORING_V1_COMPONENT_ID,
  type QueryEditorCoauthoringHostDescriptorV1,
} from '@grafana/data';
import { t, Trans } from '@grafana/i18n';
import { useFlagQueryeditorCoauthoringUi } from '@grafana/runtime/internal';
import { type DataQuery } from '@grafana/schema';
import { Alert, ErrorBoundaryAlert, Spinner, Stack, Text } from '@grafana/ui';
import { filterPanelDataToQuery } from 'app/features/query/components/QueryEditorRow';
import { QueryErrorAlert } from 'app/features/query/components/QueryErrorAlert';

import { QueryCoauthoring } from './QueryCoauthoring';
import { QueryCoauthoringHostProvider } from './QueryCoauthoringHostContext';
import { transitionQueryCoauthoringSurface, type QueryCoauthoringSurface } from './QueryCoauthoringSurfaceState';
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
  baselineRevision?: string;
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
  const queryRef = useRef(query);
  queryRef.current = query;
  const coauthoringBaselineRef = useRef<DataQuery>();
  const coauthoringPreviewTransactionRef = useRef<CoauthoringPreviewTransaction>();
  const surfaceIdentityRef = useRef({ identity: coauthoringIdentity, generation: 0 });
  if (surfaceIdentityRef.current.identity !== coauthoringIdentity) {
    surfaceIdentityRef.current = {
      identity: coauthoringIdentity,
      generation: surfaceIdentityRef.current.generation + 1,
    };
  }
  const currentSurfaceIdentity = surfaceIdentityRef.current.identity;
  const currentSurfaceGeneration = String(surfaceIdentityRef.current.generation);
  const [coauthoringBaseline, setCoauthoringBaseline] = useState<DataQuery>();
  const [coauthoringRegistration, setCoauthoringRegistration] = useState<{
    identity: string;
    capability: QueryEditorCoauthoringCapability;
  }>();
  const [coauthoringSurface, setCoauthoringSurface] = useState<QueryCoauthoringSurface>({
    identity: coauthoringIdentity,
    generation: '0',
    state: 'pending' as const,
  });
  const error = data?.errors?.find((e) => e.refId === query?.refId);
  const queryRefId = query?.refId;
  // Filter panel data to only include data for this specific query
  const filteredData = useMemo(() => {
    return queryRefId && data ? filterPanelDataToQuery(data, queryRefId) : undefined;
  }, [data, queryRefId]);

  // Key off updatedQuery.refId so late onChange calls (e.g. editor unmount cleanup) hit the right query.
  const handleChange = useCallback(
    (updatedQuery: DataQuery) => {
      if (coauthoringBaselineRef.current?.refId === updatedQuery.refId) {
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
    (proposedQuery: DataQuery, baselineRevision?: string) => {
      const currentQuery = queryRef.current;
      if (!currentQuery) {
        return;
      }

      const transaction = coauthoringPreviewTransactionRef.current;
      if (
        transaction &&
        (transaction.queryKey !== coauthoringIdentity ||
          (baselineRevision !== undefined && transaction.baselineRevision !== baselineRevision))
      ) {
        return;
      }

      const baseline = transaction?.baseline ?? currentQuery;
      coauthoringPreviewTransactionRef.current = transaction ?? {
        baseline,
        baselineRevision,
        queryKey: coauthoringIdentity,
      };
      coauthoringBaselineRef.current = baseline;
      setCoauthoringBaseline(baseline);
      updateQuery(proposedQuery, baseline.refId);
      runQueries();
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
    (acceptedQuery: DataQuery, baselineRevision?: string) => {
      const transaction = coauthoringPreviewTransactionRef.current;
      if (baselineRevision !== undefined && !transaction) {
        return;
      }
      if (
        transaction &&
        (transaction.queryKey !== coauthoringIdentity ||
          (baselineRevision !== undefined && transaction.baselineRevision !== baselineRevision))
      ) {
        return;
      }

      coauthoringPreviewTransactionRef.current = undefined;
      coauthoringBaselineRef.current = undefined;
      setCoauthoringBaseline(undefined);
      updateQuery(acceptedQuery, acceptedQuery.refId);
    },
    [coauthoringIdentity, updateQuery]
  );

  const registerCoauthoringCapability = useCallback(
    (capability: QueryEditorCoauthoringCapability | undefined) => {
      setCoauthoringRegistration(capability ? { identity: coauthoringIdentity, capability } : undefined);
    },
    [coauthoringIdentity]
  );
  const coauthoringCapability =
    coauthoringRegistration?.identity === coauthoringIdentity ? coauthoringRegistration.capability : undefined;
  const currentSurfaceState =
    coauthoringSurface.identity === currentSurfaceIdentity && coauthoringSurface.generation === currentSurfaceGeneration
      ? coauthoringSurface.state
      : 'pending';
  const coauthoringHost = useMemo(
    () => ({
      queryKey: coauthoringIdentity,
      surfaceState: currentSurfaceState,
      preview: (proposedQuery: DataQuery, baselineRevision?: string) =>
        previewCoauthoredQuery(proposedQuery, baselineRevision),
      accept: (acceptedQuery: DataQuery, baselineRevision?: string) =>
        acceptCoauthoredQuery(acceptedQuery, baselineRevision),
      revert: revertCoauthoredQueryPreview,
    }),
    [
      acceptCoauthoredQuery,
      coauthoringIdentity,
      currentSurfaceState,
      previewCoauthoredQuery,
      revertCoauthoredQueryPreview,
    ]
  );
  const onCoauthoringSurfaceStateChange = useCallback(
    (event: { generation: string; state: 'ready' | 'unavailable' | 'failed' }) => {
      if (
        surfaceIdentityRef.current.identity !== currentSurfaceIdentity ||
        String(surfaceIdentityRef.current.generation) !== currentSurfaceGeneration ||
        event.generation !== currentSurfaceGeneration
      ) {
        return;
      }
      setCoauthoringSurface((current) => {
        const expected: QueryCoauthoringSurface = {
          identity: currentSurfaceIdentity,
          generation: currentSurfaceGeneration,
          state: 'pending',
        };
        return transitionQueryCoauthoringSurface(
          current.identity === expected.identity && current.generation === expected.generation ? current : expected,
          currentSurfaceIdentity,
          event
        );
      });
    },
    [currentSurfaceGeneration, currentSurfaceIdentity]
  );
  const coauthoringHostDescriptor: QueryEditorCoauthoringHostDescriptorV1 | undefined = useMemo(
    () =>
      coauthoringEnabled
        ? {
            componentId: QUERY_EDITOR_COAUTHORING_V1_COMPONENT_ID,
            generation: currentSurfaceGeneration,
            queryKey: coauthoringIdentity,
            surfaceState: currentSurfaceState,
            onSurfaceStateChange: onCoauthoringSurfaceStateChange,
          }
        : undefined,
    [
      coauthoringEnabled,
      coauthoringIdentity,
      currentSurfaceGeneration,
      currentSurfaceIdentity,
      currentSurfaceState,
      onCoauthoringSurfaceStateChange,
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
              key={editorQuery.refId}
              app={CoreApp.PanelEditor}
              data={filteredData}
              datasource={datasource}
              onAddQuery={addQuery}
              onChange={handleChange}
              onRunQuery={runQueryWithCoauthoringSafety}
              queries={editorQueries}
              query={editorQuery}
              range={filteredData?.timeRange}
              onRegisterQueryEditorCoauthoring={coauthoringEnabled ? registerCoauthoringCapability : undefined}
              queryEditorCoauthoringHost={coauthoringHostDescriptor}
            />
          </ErrorBoundaryAlert>
        </DataSourcePluginContextProvider>
      </QueryCoauthoringHostProvider>
      {coauthoringEnabled && coauthoringHostDescriptor?.surfaceState !== 'ready' && coauthoringCapability && (
        <QueryCoauthoring
          capability={coauthoringCapability}
          onAccept={acceptCoauthoredQuery}
          onPreview={previewCoauthoredQuery}
          onRevertPreview={revertCoauthoredQueryPreview}
        />
      )}
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
