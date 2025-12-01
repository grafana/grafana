import { css } from '@emotion/css';
import { useCallback, useMemo } from 'react';
import { useAsync } from 'react-use';

import {
  CoreApp,
  DataSourceApi,
  DataSourceJsonData,
  DataSourcePluginContextProvider,
  GrafanaTheme2,
} from '@grafana/data';
import { Trans } from '@grafana/i18n';
import { getDataSourceSrv } from '@grafana/runtime';
import { VizPanel } from '@grafana/scenes';
import { ErrorBoundaryAlert, useStyles2 } from '@grafana/ui';
import { QueryOperationRow } from 'app/core/components/QueryOperationRow/QueryOperationRow';
import { ExpressionQueryEditor } from 'app/features/expressions/ExpressionQueryEditor';
import { ExpressionDatasourceUID, ExpressionQuery } from 'app/features/expressions/types';

import { getQueryRunnerFor } from '../../utils/utils';

interface ExpressionDetailViewProps {
  panel: VizPanel;
  expression: ExpressionQuery;
  expressionIndex: number;
}

export function ExpressionDetailView({ panel, expression, expressionIndex }: ExpressionDetailViewProps) {
  const styles = useStyles2(getStyles);

  const queryRunner = getQueryRunnerFor(panel);
  const queryRunnerState = queryRunner?.useState();
  const allQueries = queryRunnerState?.queries || [];

  const dsSettings = useMemo(() => getDataSourceSrv().getInstanceSettings(ExpressionDatasourceUID), []);

  // Load expression datasource
  // FIXME: handle loading and error cases
  const { value: datasource } = useAsync(
    async (): Promise<DataSourceApi<ExpressionQuery, DataSourceJsonData, {}>> =>
      // NOTE: getDataSourceSrv().get() does not correctly support generics.
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      (await getDataSourceSrv().get(ExpressionDatasourceUID)) as unknown as DataSourceApi<
        ExpressionQuery,
        DataSourceJsonData,
        {}
      >,
    []
  );

  // Subscribe to panel data
  const data = useMemo(() => {
    if (!queryRunnerState?.data) {
      return;
    }
    // Filter data for this specific expression
    const panelData = queryRunnerState.data;
    const filteredSeries = panelData.series.filter((s) => s.refId === expression.refId);
    const filteredData = {
      ...panelData,
      series: filteredSeries,
      error: panelData.errors?.find((e) => e.refId === expression.refId),
    };
    return filteredData;
  }, [queryRunnerState?.data, expression.refId]);

  const handleExpressionChange = useCallback(
    (updatedExpression: ExpressionQuery) => {
      if (queryRunner) {
        const queries = queryRunner.state.queries || [];
        const newQueries = queries.map((q, idx) => (idx === expressionIndex ? updatedExpression : q));
        queryRunner.setState({ queries: newQueries });
      }
    },
    [queryRunner, expressionIndex]
  );

  const handleRunQuery = useCallback(() => {
    if (queryRunner) {
      queryRunner.runQueries();
    }
  }, [queryRunner]);

  if (!datasource || !dsSettings) {
    return (
      <div className={styles.loading}>
        <p>
          <Trans i18nKey="dashboard-scene.expression-detail-view.loading">Loading expression editor...</Trans>
        </p>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <QueryOperationRow
        id={`expression-${expression.refId}`}
        index={expressionIndex}
        draggable={false}
        collapsable={false}
        isOpen={true}
        hideHeader={true}
      >
        <div className={styles.expressionContent}>
          <DataSourcePluginContextProvider instanceSettings={dsSettings}>
            <ErrorBoundaryAlert boundaryName="expression-editor">
              <ExpressionQueryEditor
                query={expression}
                queries={allQueries}
                datasource={datasource}
                onChange={handleExpressionChange}
                onRunQuery={handleRunQuery}
                data={data}
                app={CoreApp.PanelEditor}
              />
            </ErrorBoundaryAlert>
          </DataSourcePluginContextProvider>
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
    expressionContent: css({
      display: 'flex',
      flexDirection: 'column',
      gap: theme.spacing(1),
    }),
    loading: css({
      padding: theme.spacing(2),
      textAlign: 'center',
      color: theme.colors.text.secondary,
    }),
  };
};
