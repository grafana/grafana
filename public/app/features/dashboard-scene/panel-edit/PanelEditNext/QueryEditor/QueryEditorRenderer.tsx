import { useMemo, useState } from 'react';

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

import { useActionsContext, useQueryEditorUIContext, useQueryRunnerContext } from './QueryEditorContext';
import { QueryCoauthoringSurface } from './coauthoring/QueryCoauthoringSurface';
import {
  type InternalQueryEditorCoauthoringPropsV1,
  type QueryEditorCoauthoringAdapterV1,
  type QueryEditorCoauthoringRegistrationV1,
} from './coauthoring/internalCoauthoringContract';
import { type QueryPreview } from './coauthoring/queryPreview';
import { useQueryProposalTransaction } from './coauthoring/useQueryProposalTransaction';

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
  const proposalTransaction = useQueryProposalTransaction({
    query,
    queries,
    queryKey: coauthoringIdentity,
    adapter: coauthoringAdapter,
    updateQuery,
    runQueries,
    startQueryPreview,
  });

  const coauthoringHost = useMemo(
    () => ({
      datasourceType: coauthoringDatasourceType,
      previewPhase: proposalTransaction.previewPhase,
      timeRange: filteredData?.timeRange
        ? { from: filteredData.timeRange.from.valueOf(), to: filteredData.timeRange.to.valueOf() }
        : undefined,
      preview: proposalTransaction.preview,
      accept: proposalTransaction.accept,
      revert: proposalTransaction.revert,
    }),
    [
      coauthoringDatasourceType,
      filteredData?.timeRange,
      proposalTransaction.accept,
      proposalTransaction.preview,
      proposalTransaction.previewPhase,
      proposalTransaction.revert,
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
  return (
    <>
      <DataSourcePluginContextProvider instanceSettings={dsSettings}>
        <ErrorBoundaryAlert boundaryName="query-editor-renderer">
          <QueryEditorComponent
            key={coauthoringIdentity}
            {...internalCoauthoringProps}
            app={CoreApp.PanelEditor}
            data={filteredData}
            datasource={datasource}
            onAddQuery={addQuery}
            onChange={proposalTransaction.onChange}
            onRunQuery={proposalTransaction.run}
            queries={proposalTransaction.editorQueries}
            query={proposalTransaction.editorQuery ?? query}
            range={filteredData?.timeRange}
          />
          {coauthoringAdapter && (
            <QueryCoauthoringSurface
              adapter={coauthoringAdapter}
              host={coauthoringHost}
              onBaseline={proposalTransaction.synchronizeBaseline}
            />
          )}
        </ErrorBoundaryAlert>
      </DataSourcePluginContextProvider>
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
