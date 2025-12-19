import { css, cx } from '@emotion/css';
import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { useMeasure } from 'react-use';
import AutoSizer from 'react-virtualized-auto-sizer';

import { GrafanaTheme2, SelectableValue } from '@grafana/data';
import { Trans } from '@grafana/i18n';
import { CompletionItemKind, LanguageDefinition, SQLEditor, TableIdentifier } from '@grafana/plugin-ui';
import { reportInteraction } from '@grafana/runtime';
import { DataQuery } from '@grafana/schema/dist/esm/index';
import { formatSQL } from '@grafana/sql';
import { Button, Stack, useStyles2 } from '@grafana/ui';

import { ExpressionQueryEditorProps } from '../../ExpressionQueryEditor';
import { SqlExpressionQuery } from '../../types';
import { fetchSQLFields } from '../../utils/metaSqlExpr';
import { QueryToolbox } from '../QueryToolbox';

import { getSqlCompletionProvider } from './CompletionProvider/sqlCompletionProvider';
import { useSQLExplanations } from './GenAI/hooks/useSQLExplanations';
import { useSQLSuggestions } from './GenAI/hooks/useSQLSuggestions';
import { SchemaInspectorPanel } from './SchemaInspector/SchemaInspectorPanel';
import { SqlExprContextValue, SqlExprProvider } from './SqlExprContext';
import { SqlQueryActions } from './SqlQueryActions';
import { useSQLSchemas } from './hooks/useSQLSchemas';

const GenAISuggestionsDrawer = lazy(() =>
  import('./GenAI/GenAISuggestionsDrawer').then((module) => ({
    default: module.GenAISuggestionsDrawer,
  }))
);

const GenAIExplanationDrawer = lazy(() =>
  import('./GenAI/GenAIExplanationDrawer').then((module) => ({
    default: module.GenAIExplanationDrawer,
  }))
);

// Account for Monaco editor's border to prevent clipping
const EDITOR_BORDER_ADJUSTMENT = 2; // 1px border on top and bottom

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
  const completionProvider = useMemo(
    () =>
      getSqlCompletionProvider({
        getFields: (identifier: TableIdentifier) => fetchFields(identifier, queries || []),
        refIds,
      }),
    [queries, refIds]
  );

  // Define the language definition for MySQL syntax highlighting and autocomplete
  const EDITOR_LANGUAGE_DEFINITION: LanguageDefinition = {
    id: 'mysql',
    completionProvider,
    formatter: formatSQL,
  };

  const initialQuery = `SELECT
  *
FROM
  ${vars[0]}
LIMIT
  10`;

  const [toolboxRef, toolboxMeasure] = useMeasure<HTMLDivElement>();
  const [isSchemaInspectorOpen, setIsSchemaInspectorOpen] = useState(true);
  const styles = useStyles2((theme) => getStyles(theme));
  const { handleApplySuggestion, handleCloseDrawer, handleHistoryUpdate, handleOpenDrawer, isDrawerOpen, suggestions } =
    useSQLSuggestions();

  const {
    explanation,
    handleCloseExplanation,
    handleOpenExplanation,
    handleExplain,
    isExplanationOpen,
    shouldShowViewExplanation,
    updatePrevExpression,
  } = useSQLExplanations(query.expression || '');

  const {
    schemas,
    loading: schemasLoading,
    error: schemasError,
    isFeatureEnabled: isSchemasFeatureEnabled,
    refetch: refetchSchemas,
  } = useSQLSchemas({
    queries,
    enabled: isSchemaInspectorOpen,
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
      seriesData: metadata?.data?.series,
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
    updatePrevExpression(expression);
  };

  const onApplySuggestion = (suggestion: string) => {
    onEditorChange(suggestion);
    handleApplySuggestion(suggestion);
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

    // Refetch schemas when query is run (only if inspector is open)
    if (isSchemaInspectorOpen) {
      refetchSchemas();
    }
  }, [onRunQuery, refetchSchemas, isSchemaInspectorOpen]);

  useEffect(() => {
    // Call the onChange method once so we have access to the initial query in consuming components
    // But only if expression is empty
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

  const contextValue: SqlExprContextValue = {
    // Explanations
    explanation,
    isExplanationOpen,
    shouldShowViewExplanation,
    handleExplain,
    handleOpenExplanation,
    handleCloseExplanation,
    // Suggestions
    suggestions,
    isDrawerOpen,
    handleHistoryUpdate,
    handleApplySuggestion,
    handleOpenDrawer,
    handleCloseDrawer,
  };

  const renderButtons = () => (
    <Stack direction="row" alignItems="center" justifyContent="space-between" wrap>
      <SqlQueryActions
        executeQuery={executeQuery}
        currentQuery={query.expression || ''}
        queryContext={queryContext}
        refIds={vars}
        initialQuery={initialQuery}
        errorContext={errorContext}
      />
      {isSchemasFeatureEnabled && (
        <Button
          icon={isSchemaInspectorOpen ? 'table-collapse-all' : 'table-expand-all'}
          onClick={() => setIsSchemaInspectorOpen(!isSchemaInspectorOpen)}
          size="sm"
          variant="secondary"
          fill="outline"
        >
          {isSchemaInspectorOpen ? (
            <Trans i18nKey="expressions.sql-schema.close-schema-inspector">Close schema inspector</Trans>
          ) : (
            <Trans i18nKey="expressions.sql-schema.open-schema-inspector">Open schema inspector</Trans>
          )}
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
          {({ width, height }) => (
            <SQLEditor
              query={query.expression || initialQuery}
              onChange={onEditorChange}
              language={EDITOR_LANGUAGE_DEFINITION}
              width={width}
              height={height - EDITOR_BORDER_ADJUSTMENT - toolboxMeasure.height}
            >
              {({ formatQuery }) => (
                <div ref={toolboxRef}>
                  <QueryToolbox query={query} onFormatCode={formatQuery} />
                </div>
              )}
            </SQLEditor>
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

  const renderSQLEditor = () => (
    <Stack direction="column" gap={1}>
      {renderButtons()}
      {renderMainContent()}
    </Stack>
  );

  return (
    <SqlExprProvider value={contextValue}>
      <div className={styles.mainContainer}>
        {renderSQLEditor()}
        <Suspense fallback={null}>
          <GenAISuggestionsDrawer
            isOpen={isDrawerOpen}
            onApplySuggestion={onApplySuggestion}
            onClose={handleCloseDrawer}
            suggestions={suggestions}
          />
        </Suspense>
        <Suspense fallback={null}>
          <GenAIExplanationDrawer
            isOpen={isExplanationOpen}
            onClose={handleCloseExplanation}
            explanation={explanation}
          />
        </Suspense>
      </div>
    </SqlExprProvider>
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

async function fetchFields(identifier: TableIdentifier, queries: DataQuery[]) {
  const fields = await fetchSQLFields({ table: identifier.table }, queries);
  return fields.map((t) => ({ name: t.name, completion: t.value, kind: CompletionItemKind.Field }));
}
