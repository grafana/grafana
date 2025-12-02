import { css } from '@emotion/css';
import { useCallback, useMemo } from 'react';
import { useAsync } from 'react-use';

import { CoreApp, DataQuery, DataSourcePluginContextProvider, GrafanaTheme2, TimeRange } from '@grafana/data';
import { Trans } from '@grafana/i18n';
import { getDataSourceSrv } from '@grafana/runtime';
import { SceneDataQuery, VizPanel } from '@grafana/scenes';
import { ErrorBoundaryAlert, useStyles2 } from '@grafana/ui';
import { QueryOperationRow } from 'app/core/components/QueryOperationRow/QueryOperationRow';
import { QueryErrorAlert } from 'app/features/query/components/QueryErrorAlert';

import { getQueryRunnerFor } from '../../utils/utils';

interface QueryDetailViewProps {
  panel: VizPanel;
  query: SceneDataQuery;
  queryIndex: number;
}

export function QueryDetailView({ panel, query, queryIndex }: QueryDetailViewProps) {
  const styles = useStyles2(getStyles);

  const dsSettings = useMemo(() => {
    try {
      return getDataSourceSrv().getInstanceSettings(query.datasource);
    } catch {
      return getDataSourceSrv().getInstanceSettings(null);
    }
  }, [query.datasource]);

  const queryRunner = getQueryRunnerFor(panel);
  const queryRunnerState = queryRunner?.useState();
  const timeRange: TimeRange | undefined = queryRunner?.state.$timeRange?.state.value;

  // Load datasource
  // FIXME: handle loading and error cases
  const { value: datasource } = useAsync(async () => {
    try {
      return await getDataSourceSrv().get(query.datasource);
    } catch {
      return await getDataSourceSrv().get();
    }
  }, [query.datasource]);

  // Subscribe to panel data
  const data = useMemo(() => {
    if (!queryRunnerState?.data) {
      return;
    }
    // Filter data for this specific query
    const panelData = queryRunnerState.data;
    const filteredSeries = panelData.series.filter((s) => s.refId === query.refId);
    return {
      ...panelData,
      series: filteredSeries,
      error: panelData.errors?.find((e) => e.refId === query.refId),
    };
  }, [queryRunnerState?.data, query.refId]);

  const handleQueryChange = useCallback(
    (updatedQuery: DataQuery) => {
      if (queryRunner) {
        const queries = queryRunner.state.queries || [];
        const newQueries = queries.map((q, idx) => (idx === queryIndex ? updatedQuery : q));
        queryRunner.setState({ queries: newQueries });
      }
    },
    [queryRunner, queryIndex]
  );

  const handleRunQuery = useCallback(() => {
    if (queryRunner) {
      queryRunner.runQueries();
    }
  }, [queryRunner]);

  const renderQueryEditor = () => {
    if (!datasource || !dsSettings) {
      return (
        <div className={styles.noEditor}>
          <Trans i18nKey="dashboard-scene.query-detail-view.loading">Loading data source...</Trans>
        </div>
      );
    }

    const QueryEditor = datasource.components?.QueryEditor;
    if (!QueryEditor) {
      return (
        <div className={styles.noEditor}>
          <Trans i18nKey="dashboard-scene.query-detail-view.no-editor">
            This data source does not have a query editor
          </Trans>
        </div>
      );
    }

    return (
      <DataSourcePluginContextProvider instanceSettings={dsSettings}>
        <ErrorBoundaryAlert boundaryName="query-editor">
          <QueryEditor
            query={query}
            datasource={datasource}
            onChange={handleQueryChange}
            onRunQuery={handleRunQuery}
            data={data}
            range={timeRange}
            app={CoreApp.PanelEditor}
          />
        </ErrorBoundaryAlert>
      </DataSourcePluginContextProvider>
    );
  };

  const error = data?.error || data?.errors?.find((e) => e.refId === query.refId);

  return (
    <div className={styles.container}>
      <QueryOperationRow
        id={`query-${query.refId}`}
        index={queryIndex}
        draggable={false}
        collapsable={false}
        isOpen={true}
        hideHeader={true}
      >
        <div className={styles.queryContent}>
          {renderQueryEditor()}
          {error && <QueryErrorAlert error={error} />}
        </div>
      </QueryOperationRow>
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2) => {
  return {
    container: css({
      display: 'flex',
      flexDirection: 'column',
      gap: theme.spacing(2),
      padding: theme.spacing(2),
      width: '100%',
    }),
    queryContent: css({
      display: 'flex',
      flexDirection: 'column',
      gap: theme.spacing(1),
    }),
    noEditor: css({
      padding: theme.spacing(2),
      textAlign: 'center',
      color: theme.colors.text.secondary,
    }),
  };
};
