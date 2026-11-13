import { ProviderStatus, useBooleanFlagDetails, useOpenFeatureClientStatus } from '@openfeature/react-sdk';
import { type ComponentProps, type ComponentType, useEffect, useMemo, useState } from 'react';

import {
  CoreApp,
  type DataSourceApi,
  type DataSourceInstanceSettings,
  DataSourcePluginContextProvider,
  type PanelData,
} from '@grafana/data';
import { t, Trans } from '@grafana/i18n';
import { FlagKeys } from '@grafana/runtime/internal';
import { type VizPanel } from '@grafana/scenes';
import { type DataQuery } from '@grafana/schema';
import { Alert, ErrorBoundaryAlert, Spinner, Stack, Text } from '@grafana/ui';
import { filterPanelDataToQuery } from 'app/features/query/components/QueryEditorRow';
import { QueryErrorAlert } from 'app/features/query/components/QueryErrorAlert';

import { DatasourceErrorAlert } from './DatasourceErrorAlert';
import {
  useActionsContext,
  usePanelContext,
  useQueryEditorUIContext,
  useQueryRunnerContext,
} from './QueryEditorContext';
import { useCoauthoringEditor } from './coauthoring/QueryCoauthoringEditor';
import { QueryCoauthoringSurface } from './coauthoring/QueryCoauthoringSurface';
import {
  type InternalQueryEditorCoauthoringPropsV1,
  type QueryEditorCoauthoringAdapterV1,
  type QueryEditorCoauthoringRegistrationV1,
} from './coauthoring/internalCoauthoringContract';
import { type QueryEditorPropsWithCoauthoring } from './coauthoring/queryCoauthoringContracts';
import { reportQueryCoauthoringDecision } from './coauthoring/queryCoauthoringDecision';
import { type QueryPreview } from './coauthoring/queryPreview';
import { supportsQueryCoauthoring } from './coauthoring/supportsQueryCoauthoring';
import { useQueryProposalTransaction } from './coauthoring/useQueryProposalTransaction';

interface QueryDatasourceData {
  datasource?: DataSourceApi;
  dsSettings?: DataSourceInstanceSettings;
}

interface QueryEditorPanelProps {
  panel: VizPanel;
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
  panel,
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
  const v2 = useCoauthoringEditor(query, queries);
  const coauthoringFlag = useBooleanFlagDetails(FlagKeys.QueryeditorCoauthoringUi, false);
  const providerStatus = useOpenFeatureClientStatus();
  const coauthoringEnabled = coauthoringFlag.value;
  const coauthoringSupported = supportsQueryCoauthoring(queryDsData?.dsSettings);
  const canOfferCoauthoring = Boolean(
    query && !queryDsLoading && queryDsData?.datasource?.components?.QueryEditor && coauthoringSupported
  );
  const { value, variant, errorCode } = coauthoringFlag;
  useEffect(() => {
    if (providerStatus === ProviderStatus.READY && canOfferCoauthoring) {
      reportQueryCoauthoringDecision(panel, { value, variant, errorCode });
    }
  }, [panel, providerStatus, canOfferCoauthoring, value, variant, errorCode]);
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

  const revertV1 = proposalTransaction.revert;
  useEffect(() => {
    if (v2.active) {
      revertV1();
    }
  }, [v2.active, revertV1]);

  const coauthoringHost = useMemo(
    () => ({
      datasourceType: coauthoringDatasourceType,
      previewPhase: proposalTransaction.previewPhase,
      previewData: proposalTransaction.previewData,
      readPreviewData: proposalTransaction.readPreviewData,
      timeRange: filteredData?.timeRange
        ? { from: filteredData.timeRange.from.valueOf(), to: filteredData.timeRange.to.valueOf() }
        : undefined,
      preview: proposalTransaction.preview,
      peek: proposalTransaction.peek,
      stopPeek: proposalTransaction.stopPeek,
      accept: proposalTransaction.accept,
      revert: proposalTransaction.revert,
    }),
    [
      coauthoringDatasourceType,
      filteredData?.timeRange,
      proposalTransaction.accept,
      proposalTransaction.preview,
      proposalTransaction.peek,
      proposalTransaction.stopPeek,
      proposalTransaction.previewPhase,
      proposalTransaction.previewData,
      proposalTransaction.readPreviewData,
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
      coauthoringEnabled && !v2.active && coauthoringSupported ? coauthoringRegistration : undefined,
  };
  const Editor: ComponentType<QueryEditorPropsWithCoauthoring<ComponentProps<typeof QueryEditorComponent>>> =
    QueryEditorComponent;
  return (
    <>
      {v2.toolbar}
      <DataSourcePluginContextProvider instanceSettings={dsSettings}>
        <ErrorBoundaryAlert boundaryName="query-editor-renderer">
          <Editor
            key={coauthoringIdentity}
            {...internalCoauthoringProps}
            {...(v2.host ? { queryCoauthoring: v2.host } : {})}
            app={CoreApp.PanelEditor}
            data={filteredData}
            datasource={datasource}
            onAddQuery={addQuery}
            onChange={proposalTransaction.onChange}
            onRunQuery={proposalTransaction.run}
            queries={v2.active ? v2.editorQueries : proposalTransaction.editorQueries}
            query={(v2.active ? v2.editorQuery : proposalTransaction.editorQuery) ?? query}
            range={filteredData?.timeRange}
          />
          {!v2.active && coauthoringAdapter && (
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
  const { panel } = usePanelContext();
  const { queries, data } = useQueryRunnerContext();
  const { selectedQuery, selectedQueryDsData, selectedQueryDsLoading } = useQueryEditorUIContext();
  const { updateSelectedQuery, addQuery, runQueries, startQueryPreview } = useActionsContext();

  return (
    <>
      <DatasourceErrorAlert />
      <QueryEditorPanel
        panel={panel}
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
    </>
  );
}
