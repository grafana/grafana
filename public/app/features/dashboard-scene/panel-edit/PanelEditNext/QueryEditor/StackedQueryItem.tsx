import { useCallback, useMemo } from 'react';

import {
  CoreApp,
  DataSourcePluginContextProvider,
  type DataSourceInstanceSettings,
  type PanelData,
} from '@grafana/data';
import { t, Trans } from '@grafana/i18n';
import { type DataQuery } from '@grafana/schema';
import { Alert, Icon, Spinner, Stack, Text, useTheme2 } from '@grafana/ui';
import { DataSourceLogo } from 'app/features/datasources/components/picker/DataSourceLogo';
import { filterPanelDataToQuery } from 'app/features/query/components/QueryEditorRow';

import { getQueryEditorTypeConfig, QueryEditorType } from '../constants';

import { useActionsContext, useQueryRunnerContext } from './QueryEditorContext';
import { StackedItemShell } from './StackedItemShell';
import { useSelectedQueryDatasource } from './hooks/useSelectedQueryDatasource';
import { getEditorType } from './utils';

interface StackedQueryItemProps {
  query: DataQuery;
  panelDsSettings: DataSourceInstanceSettings | undefined;
  panelData: PanelData | undefined;
}

export function StackedQueryItem({ query, panelDsSettings, panelData }: StackedQueryItemProps) {
  const editorType = getEditorType(query);
  const { selectedQueryDsData, selectedQueryDsLoading } = useSelectedQueryDatasource(query, panelDsSettings);
  const { queries } = useQueryRunnerContext();
  const { updateSelectedQuery, addQuery, runQueries } = useActionsContext();
  const theme = useTheme2();

  const typeConfig = getQueryEditorTypeConfig(theme);

  const filteredData = useMemo(
    () => (panelData ? filterPanelDataToQuery(panelData, query.refId) : undefined),
    [panelData, query.refId]
  );

  const handleChange = useCallback(
    (updatedQuery: DataQuery) => {
      updateSelectedQuery(updatedQuery, query.refId);
    },
    [updateSelectedQuery, query.refId]
  );

  const label =
    editorType === QueryEditorType.Expression
      ? t('query-editor-next.stacked-view.expression', 'Expression')
      : (selectedQueryDsData?.dsSettings?.name ?? '');

  const icon =
    editorType === QueryEditorType.Query ? (
      <DataSourceLogo dataSource={selectedQueryDsData?.dsSettings} size={14} />
    ) : (
      <Icon name={typeConfig[editorType].icon} color={typeConfig[editorType].color} size="sm" />
    );

  return (
    <StackedItemShell editorType={editorType} icon={icon} label={label} name={query.refId} isHidden={query.hide}>
      <StackedQueryItemBody
        query={query}
        queries={queries}
        dsData={selectedQueryDsData}
        loading={selectedQueryDsLoading}
        filteredData={filteredData}
        onChange={handleChange}
        onRunQuery={runQueries}
        onAddQuery={addQuery}
      />
    </StackedItemShell>
  );
}

interface StackedQueryItemBodyProps {
  query: DataQuery;
  queries: DataQuery[];
  dsData: ReturnType<typeof useSelectedQueryDatasource>['selectedQueryDsData'];
  loading: boolean;
  filteredData: ReturnType<typeof filterPanelDataToQuery> | undefined;
  onChange: (updatedQuery: DataQuery) => void;
  onRunQuery: () => void;
  onAddQuery: (query?: Partial<DataQuery>, afterRefId?: string) => string | undefined;
}

function StackedQueryItemBody({
  query,
  queries,
  dsData,
  loading,
  filteredData,
  onChange,
  onRunQuery,
  onAddQuery,
}: StackedQueryItemBodyProps) {
  if (loading) {
    return (
      <Stack gap={1}>
        <Spinner />
        <Text>
          <Trans i18nKey="query-editor-renderer.loading-datasource">Loading datasource</Trans>
        </Text>
      </Stack>
    );
  }

  if (!dsData?.datasource || !dsData?.dsSettings) {
    return (
      <Alert
        severity="error"
        title={t('query-editor-renderer.datasource-load-error-title', 'Failed to load datasource for this query')}
      />
    );
  }

  const QueryEditorComponent = dsData.datasource.components?.QueryEditor;
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

  return (
    <DataSourcePluginContextProvider instanceSettings={dsData.dsSettings}>
      <QueryEditorComponent
        key={query.refId}
        app={CoreApp.Dashboard}
        data={filteredData}
        datasource={dsData.datasource}
        onAddQuery={onAddQuery}
        onChange={onChange}
        onRunQuery={onRunQuery}
        queries={queries}
        query={query}
        range={filteredData?.timeRange}
      />
    </DataSourcePluginContextProvider>
  );
}
