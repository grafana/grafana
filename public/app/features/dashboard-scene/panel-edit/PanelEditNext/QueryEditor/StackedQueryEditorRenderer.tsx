import { css } from '@emotion/css';
import { useCallback, useMemo, useRef } from 'react';

import { CoreApp, DataSourceInstanceSettings, DataSourcePluginContextProvider, GrafanaTheme2 } from '@grafana/data';
import { t, Trans } from '@grafana/i18n';
import { isExpressionReference } from '@grafana/runtime';
import { DataQuery } from '@grafana/schema';
import { Alert, Button, Icon, Spinner, Stack, Text, useStyles2 } from '@grafana/ui';
import { useDatasource } from 'app/features/datasources/hooks';
import { filterPanelDataToQuery } from 'app/features/query/components/QueryEditorRow';
import { QueryErrorAlert } from 'app/features/query/components/QueryErrorAlert';

import { QUERY_EDITOR_TYPE_CONFIG, QueryEditorType } from '../constants';

import { useActionsContext, useDatasourceContext, useQueryEditorUIContext, useQueryRunnerContext } from './QueryEditorContext';
import { useSelectedQueryDatasource } from './hooks/useSelectedQueryDatasource';
import { getEditorBorderColor } from './utils';

/**
 * Renders all selected queries stacked vertically, each with its own
 * compact header and query editor. Used when the user activates "View stacked"
 * from the bulk actions bar.
 */
export function StackedQueryEditorRenderer() {
  const styles = useStyles2(getStyles);
  const { selectedQueryRefIds, setStackedView, clearSelection } = useQueryEditorUIContext();
  const { queries } = useQueryRunnerContext();

  const selectedQueries = useMemo(
    () => selectedQueryRefIds.map((refId) => queries.find((q) => q.refId === refId)).filter(Boolean) as DataQuery[],
    [selectedQueryRefIds, queries]
  );

  return (
    <div className={styles.container}>
      <div className={styles.stackedHeader}>
        <Stack direction="row" alignItems="center" gap={1}>
          <Icon name="layers-alt" size="sm" />
          <Text variant="body" color="secondary">
            <Trans i18nKey="query-editor-next.stacked-view.header" values={{ count: selectedQueries.length }}>
              {'Viewing {{count}} queries'}
            </Trans>
          </Text>
        </Stack>
        <Stack direction="row" gap={0.5}>
          <Button
            size="sm"
            variant="secondary"
            fill="text"
            icon="times"
            onClick={() => {
              setStackedView(false);
              clearSelection();
            }}
            tooltip={t('query-editor-next.stacked-view.exit', 'Exit stacked view')}
          >
            <Trans i18nKey="query-editor-next.stacked-view.exit">Exit stacked view</Trans>
          </Button>
        </Stack>
      </div>
      <div className={styles.stackedList}>
        {selectedQueries.map((query) => (
          <StackedQueryItem key={query.refId} query={query} />
        ))}
      </div>
    </div>
  );
}

function StackedQueryItem({ query }: { query: DataQuery }) {
  const styles = useStyles2(getItemStyles);
  const { dsSettings: panelDsSettings } = useDatasourceContext();
  const { queries, data } = useQueryRunnerContext();
  const { updateSelectedQuery, addQuery, runQueries } = useActionsContext();
  const { selectedQueryDsData, selectedQueryDsLoading } = useSelectedQueryDatasource(query, panelDsSettings);
  const queryDsSettings = useDatasource(query.datasource);
  const error = data?.errors?.find((e) => e.refId === query.refId);

  const refIdRef = useRef(query.refId);
  refIdRef.current = query.refId;

  const filteredData = useMemo(() => {
    return data ? filterPanelDataToQuery(data, query.refId) : undefined;
  }, [data, query.refId]);

  const handleChange = useCallback(
    (updatedQuery: DataQuery) => {
      if (updatedQuery.refId !== refIdRef.current) {
        return;
      }
      updateSelectedQuery(updatedQuery, refIdRef.current);
    },
    [updateSelectedQuery]
  );

  return (
    <div className={styles.item}>
      <StackedItemHeader refId={query.refId} dsSettings={queryDsSettings} isExpression={isExpressionReference(query.datasource)} />
      <div className={styles.editorContent}>
        {selectedQueryDsLoading && (
          <Stack gap={1}>
            <Spinner />
            <Text>
              <Trans i18nKey="query-editor-renderer.loading-datasource">Loading datasource</Trans>
            </Text>
          </Stack>
        )}
        {!selectedQueryDsLoading && !selectedQueryDsData?.datasource && (
          <Alert
            severity="error"
            title={t('query-editor-renderer.datasource-load-error-title', 'Failed to load datasource for this query')}
          />
        )}
        {!selectedQueryDsLoading && selectedQueryDsData?.datasource && selectedQueryDsData?.dsSettings && (() => {
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

          return (
            <DataSourcePluginContextProvider instanceSettings={selectedQueryDsData.dsSettings}>
              <QueryEditorComponent
                key={query.refId}
                app={CoreApp.Dashboard}
                data={filteredData}
                datasource={selectedQueryDsData.datasource}
                onAddQuery={addQuery}
                onChange={handleChange}
                onRunQuery={runQueries}
                queries={queries}
                query={query}
                range={filteredData?.timeRange}
              />
            </DataSourcePluginContextProvider>
          );
        })()}
        {error && <QueryErrorAlert error={error} />}
      </div>
    </div>
  );
}

function StackedItemHeader({
  refId,
  dsSettings,
  isExpression,
}: {
  refId: string;
  dsSettings?: DataSourceInstanceSettings;
  isExpression: boolean;
}) {
  const styles = useStyles2(getItemHeaderStyles, isExpression);
  const editorType = isExpression ? QueryEditorType.Expression : QueryEditorType.Query;

  return (
    <div className={styles.header}>
      <Stack direction="row" alignItems="center" gap={1}>
        <Icon name={QUERY_EDITOR_TYPE_CONFIG[editorType].icon} size="sm" />
        {!isExpression && dsSettings && (
          <img src={dsSettings.meta.info.logos.small} alt="" width={16} height={16} className={styles.dsLogo} />
        )}
        <Text variant="code" color="primary" weight="medium">
          {refId}
        </Text>
        {!isExpression && dsSettings && (
          <Text variant="bodySmall" color="secondary">
            {dsSettings.name}
          </Text>
        )}
        {isExpression && (
          <Text variant="bodySmall" color="secondary">
            Expression
          </Text>
        )}
      </Stack>
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  container: css({
    display: 'flex',
    flexDirection: 'column',
  }),
  stackedHeader: css({
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: theme.spacing(1, 1.5),
    borderBottom: `1px solid ${theme.colors.border.weak}`,
    backgroundColor: theme.colors.background.secondary,
    position: 'sticky' as const,
    top: theme.spacing(-2),
    // Offset the parent scrollableContent padding so the sticky header spans full width
    margin: theme.spacing(-2, -2, 0, -2),
    padding: theme.spacing(1, 2),
    zIndex: 1,
  }),
  stackedList: css({
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(1),
    paddingTop: theme.spacing(1),
  }),
});

const getItemStyles = (theme: GrafanaTheme2) => {
  return {
    item: css({
      display: 'flex',
      flexDirection: 'column',
      border: `1px solid ${theme.colors.border.weak}`,
      borderRadius: theme.shape.radius.default,
      overflow: 'hidden',
      backgroundColor: theme.colors.background.primary,

      '&:first-child': {
        borderTop: 'none',
        borderTopLeftRadius: 0,
        borderTopRightRadius: 0,
      },
    }),
    editorContent: css({
      padding: theme.spacing(2),
    }),
  };
};

const getItemHeaderStyles = (theme: GrafanaTheme2, isExpression: boolean) => {
  const editorType = isExpression ? QueryEditorType.Expression : QueryEditorType.Query;
  const borderColor = getEditorBorderColor({ theme, editorType });

  return {
    header: css({
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: theme.spacing(0.75, 1),
      paddingLeft: `calc(${theme.spacing(1)} + 3px)`,
      backgroundColor: theme.colors.background.secondary,
      borderBottom: `1px solid ${theme.colors.border.weak}`,
      position: 'relative',

      '&::before': {
        content: '""',
        position: 'absolute',
        left: 0,
        top: 0,
        bottom: 0,
        width: 3,
        background: borderColor,
      },
    }),
    dsLogo: css({
      borderRadius: theme.shape.radius.circle,
    }),
  };
};
