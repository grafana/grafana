import { css } from '@emotion/css';
import { useCallback, useEffect, useState } from 'react';

import {
  CoreApp,
  DataSourceApi,
  DataSourceInstanceSettings,
  DataSourcePluginContextProvider,
  GrafanaTheme2,
  PanelData,
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
  const [datasource, setDatasource] = useState<DataSourceApi | null>(null);
  const [dsSettings, setDsSettings] = useState<DataSourceInstanceSettings | null>(null);
  const [data, setData] = useState<PanelData | undefined>();

  const queryRunner = getQueryRunnerFor(panel);
  const queryRunnerState = queryRunner?.useState();
  const allQueries = queryRunnerState?.queries || [];

  // Load expression datasource
  useEffect(() => {
    const loadDatasource = async () => {
      try {
        const ds = await getDataSourceSrv().get(ExpressionDatasourceUID);
        const settings = getDataSourceSrv().getInstanceSettings(ExpressionDatasourceUID);
        setDatasource(ds);
        setDsSettings(settings || null);
      } catch (error) {
        console.error('Failed to load expression datasource:', error);
      }
    };

    loadDatasource();
  }, []);

  // Subscribe to panel data
  useEffect(() => {
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
    setData(filteredData);
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
                // @ts-ignore - Expression datasource is compatible at runtime
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
