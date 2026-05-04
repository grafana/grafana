import { css, cx } from '@emotion/css';
import { useCallback, useEffect, useMemo } from 'react';
import { useLocalStorage, useMeasure } from 'react-use';
import AutoSizer, { type Size } from 'react-virtualized-auto-sizer';

import { type GrafanaTheme2, type SelectableValue } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { config, reportInteraction } from '@grafana/runtime';
import { type DataQuery } from '@grafana/schema';
import { formatSQL } from '@grafana/sql';
import { Button, Stack, useStyles2 } from '@grafana/ui';

import { type ExpressionQueryEditorProps } from '../../ExpressionQueryEditor';
import { type SqlExpressionQuery } from '../../types';
import { ALLOWED_FUNCTIONS, fetchSQLFields } from '../../utils/metaSqlExpr';
import { QueryToolbox } from '../QueryToolbox';

import { SchemaInspectorPanel } from './SchemaInspector/SchemaInspectorPanel';
import { SqlEditor } from './SqlEditor/SqlEditor';
import { type SqlCompletionProvider } from './SqlEditor/utils';
import { SqlQueryActions } from './SqlQueryActions';
import { useSQLSchemas } from './hooks/useSQLSchemas';

// Account for the editor border to prevent clipping
const EDITOR_BORDER_ADJUSTMENT = 2; // 1px border on top and bottom
const SCHEMA_INSPECTOR_OPEN_KEY = 'grafana.sql-expression.schema-inspector-open';
const CLAUSE_COMPLETIONS = [
  'WHERE',
  'GROUP BY',
  'ORDER BY',
  'HAVING',
  'LIMIT',
  'JOIN',
  'LEFT JOIN',
  'INNER JOIN',
] as const;

export interface SqlExprProps {
  refIds: Array<SelectableValue<string>>;
  query: SqlExpressionQuery;
  queries: DataQuery[] | undefined;
  onChange: (query: SqlExpressionQuery) => void;
  onRunQuery?: () => void;
  /** Should the `format` property be set to `alerting`? */
  alerting?: boolean;
  metadata?: ExpressionQueryEditorProps;
}

export const SqlExpr = ({ onChange, refIds, query, alerting = false, queries, metadata, onRunQuery }: SqlExprProps) => {
  const vars = useMemo(() => refIds.map((v) => v.value!), [refIds]);
  const completionProvider = useMemo<SqlCompletionProvider>(
    () => ({
      tables: () =>
        refIds.map((refId) => ({
          label: refId.label || refId.value || '',
          insertText: refId.label || refId.value || '',
          kind: 'table',
          boost: 99,
        })),
      columns: async ({ table }) => {
        if (!config.featureToggles.sqlExpressionsColumnAutoComplete) {
          return [];
        }

        try {
          return await fetchFields(table, queries || []);
        } catch {
          return [];
        }
      },
      clauses: () =>
        CLAUSE_COMPLETIONS.map((clause) => ({
          label: clause,
          kind: 'clause',
        })),
      functions: () =>
        ALLOWED_FUNCTIONS.map((func) => ({
          label: func,
          insertText: func,
          kind: 'function',
        })),
    }),
    [queries, refIds]
  );

  const initialQuery = `SELECT
  *
FROM
  ${vars[0]}
LIMIT
  10`;

  const [toolboxRef, toolboxMeasure] = useMeasure<HTMLDivElement>();
  const [isSchemaInspectorOpen = true, setIsSchemaInspectorOpen] = useLocalStorage(SCHEMA_INSPECTOR_OPEN_KEY, true);

  const styles = useStyles2((theme) => getStyles(theme));

  const {
    schemas,
    loading: schemasLoading,
    error: schemasError,
    isFeatureEnabled: isSchemasFeatureEnabled,
    refetch: refetchSchemas,
  } = useSQLSchemas({
    queries,
    enabled: true,
    timeRange: metadata?.range,
  });

  const queryContext = useMemo(
    () => ({
      alerting,
      panelId: metadata?.data?.request?.panelPluginId,
      queries: metadata?.queries,
      dashboardContext: {
        dashboardTitle: metadata?.data?.request?.dashboardTitle ?? '',
        panelName: metadata?.data?.request?.panelName ?? '',
      },
      datasources: metadata?.queries?.map((query) => query.datasource?.type ?? '') ?? [],
      totalRows: metadata?.data?.series.reduce((sum, frame) => sum + frame.length, 0),
      requestTime: metadata?.data?.request?.endTime
        ? metadata?.data?.request?.endTime - metadata?.data?.request?.startTime
        : -1,
      numberOfQueries: metadata?.data?.request?.targets?.length ?? 0,
    }),
    [alerting, metadata]
  );

  const errorContext = useMemo(() => {
    if (!metadata?.data) {
      return [];
    }

    const errors: string[] = [];

    // Handle multiple errors (preferred)
    if (metadata.data.errors?.length) {
      errors.push(...metadata.data.errors.map((err) => err.message).filter((msg): msg is string => Boolean(msg)));
    }
    // Handle legacy single error
    else if (metadata.data.error?.message) {
      errors.push(metadata.data.error.message);
    }

    return errors;
  }, [metadata?.data]);

  const onEditorChange = (expression: string) => {
    onChange({
      ...query,
      expression,
      format: alerting ? 'alerting' : undefined,
    });
  };

  const executeQuery = useCallback(() => {
    if (onRunQuery) {
      reportInteraction('dashboards_expression_interaction', {
        action: 'execute_expression',
        expression_type: 'sql',
        context: 'expression_editor',
      });

      onRunQuery();
    }

    refetchSchemas();
  }, [onRunQuery, refetchSchemas]);

  // Call the onChange method once so we have access to the initial query in consuming components
  // But only if expression is empty
  useEffect(() => {
    if (!query.expression) {
      onEditorChange(initialQuery);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // cmd/ctrl + enter to run query
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const isMac = navigator.userAgent.includes('Mac');
      const isCmdOrCtrl = isMac ? event.metaKey : event.ctrlKey;

      if (isCmdOrCtrl && event.key === 'Enter') {
        event.preventDefault();
        event.stopPropagation();
        executeQuery();
      }
    };

    document.addEventListener('keydown', handleKeyDown, true);
    return () => document.removeEventListener('keydown', handleKeyDown, true);
  }, [executeQuery]);

  const renderButtons = () => (
    <Stack direction="row" alignItems="center" justifyContent="space-between" wrap>
      <SqlQueryActions
        executeQuery={executeQuery}
        currentQuery={query.expression || ''}
        queryContext={queryContext}
        refIds={vars}
        initialQuery={initialQuery}
        errorContext={errorContext}
        schemas={schemas?.sqlSchemas ?? null}
      />
      {isSchemasFeatureEnabled && (
        <Button
          icon={isSchemaInspectorOpen ? 'eye' : 'eye-slash'}
          onClick={() => setIsSchemaInspectorOpen(!isSchemaInspectorOpen)}
          size="sm"
          variant="secondary"
          fill="outline"
        >
          <Trans i18nKey="expressions.sql-schema.schema-inspector">Schema inspector</Trans>
        </Button>
      )}
    </Stack>
  );

  const renderMainContent = () => (
    <div
      className={cx(styles.contentContainer, {
        [styles.contentContainerWithSchema]: isSchemaInspectorOpen && isSchemasFeatureEnabled,
      })}
    >
      <div className={styles.editorContainer}>
        <AutoSizer>
          {({ width, height }: Size) => (
            <div style={{ width }}>
              <SqlEditor
                value={query.expression ?? initialQuery}
                onChange={onEditorChange}
                completionProvider={completionProvider}
                completionMode="merge"
                formatter={formatSQL}
                height={height - EDITOR_BORDER_ADJUSTMENT - toolboxMeasure.height}
                ariaLabel={t('expressions.sql-expression.editor.aria-label', 'SQL expression editor')}
              >
                {({ formatQuery }) => (
                  <div ref={toolboxRef}>
                    <QueryToolbox query={query} onFormatCode={formatQuery} />
                  </div>
                )}
              </SqlEditor>
            </div>
          )}
        </AutoSizer>
      </div>
      {isSchemaInspectorOpen && isSchemasFeatureEnabled && (
        <div className={styles.schemaInspector}>
          <SchemaInspectorPanel schemas={schemas?.sqlSchemas ?? null} loading={schemasLoading} error={schemasError} />
        </div>
      )}
    </div>
  );

  return (
    <div className={styles.mainContainer} data-testid="sql-expression-editor">
      <Stack direction="column" gap={1}>
        {renderButtons()}
        {renderMainContent()}
      </Stack>
    </div>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  mainContainer: css({
    marginTop: theme.spacing(0.5),
  }),
  contentContainer: css({
    minHeight: '250px',
    height: '100%',
    resize: 'vertical',
    overflow: 'hidden',

    display: 'grid',
    gridTemplateColumns: '1fr 0fr',
    gridTemplateAreas: '"editor schema"',
    [theme.transitions.handleMotion('no-preference')]: {
      transition: theme.transitions.create(['grid-template-columns'], {
        duration: theme.transitions.duration.standard,
      }),
    },
  }),
  contentContainerWithSchema: css({
    gridTemplateColumns: '1fr 1fr',
    gap: theme.spacing(1),
  }),
  editorContainer: css({
    gridArea: 'editor',
    height: '100%',
    width: '100%',
    overflow: 'auto',
  }),
  schemaInspector: css({
    gridArea: 'schema',
    height: '100%',
    overflow: 'hidden',
    minWidth: 0,
    border: `1px solid ${theme.colors.border.weak}`,
    borderRadius: theme.shape.radius.default,
  }),
});

async function fetchFields(table: string | undefined, queries: DataQuery[]) {
  const fields = await fetchSQLFields({ table }, queries);
  return fields.map((field) => ({ label: field.name, insertText: field.value, kind: 'column' as const, boost: 50 }));
}
