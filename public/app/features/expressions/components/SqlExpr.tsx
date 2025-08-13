import { css } from '@emotion/css';
import { useMemo, useRef, useEffect, useState, lazy, Suspense, useCallback } from 'react';
import { useMeasure } from 'react-use';
import AutoSizer from 'react-virtualized-auto-sizer';

import { SelectableValue, GrafanaTheme2 } from '@grafana/data';
import { t, Trans } from '@grafana/i18n';
import { SQLEditor, CompletionItemKind, LanguageDefinition, TableIdentifier } from '@grafana/plugin-ui';
import { DataQuery } from '@grafana/schema/dist/esm/index';
import { formatSQL } from '@grafana/sql';
import { useStyles2, Stack, Button, Modal } from '@grafana/ui';

import { ExpressionQueryEditorProps } from '../ExpressionQueryEditor';
import { SqlExpressionQuery } from '../types';
import { fetchSQLFields } from '../utils/metaSqlExpr';

import { useSQLExplanations } from './GenAI/hooks/useSQLExplanations';
import { useSQLSuggestions } from './GenAI/hooks/useSQLSuggestions';
import { QueryToolbox } from './QueryToolbox';
import { getSqlCompletionProvider } from './sqlCompletionProvider';

// Lazy load the GenAI components to avoid circular dependencies
const GenAISQLSuggestionsButton = lazy(() =>
  import('./GenAI/GenAISQLSuggestionsButton').then((module) => ({
    default: module.GenAISQLSuggestionsButton,
  }))
);

const GenAISQLExplainButton = lazy(() =>
  import('./GenAI/GenAISQLExplainButton').then((module) => ({
    default: module.GenAISQLExplainButton,
  }))
);

const SuggestionsDrawerButton = lazy(() =>
  import('./GenAI/SuggestionsDrawerButton').then((module) => ({
    default: module.SuggestionsDrawerButton,
  }))
);

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

  const styles = useStyles2(getStyles);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ height: 0 });
  const [toolboxRef, toolboxMeasure] = useMeasure<HTMLDivElement>();
  const [isExpanded, setIsExpanded] = useState(false);

  const { handleApplySuggestion, handleHistoryUpdate, handleCloseDrawer, handleOpenDrawer, isDrawerOpen, suggestions } =
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
    if (query.expression && onRunQuery) {
      onRunQuery();
    }
  }, [query.expression, onRunQuery]);

  // Set up resize observer to handle container resizing
  useEffect(() => {
    if (!containerRef.current) {
      return;
    }

    const resizeObserver = new ResizeObserver((entries) => {
      const { height } = entries[0].contentRect;
      setDimensions({ height });
    });

    resizeObserver.observe(containerRef.current);
    return () => resizeObserver.disconnect();
  }, []);

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

  const renderToolbox = (formatQuery: () => void) => (
    <div ref={toolboxRef}>
      <QueryToolbox query={query} onFormatCode={formatQuery} onExpand={setIsExpanded} isExpanded={isExpanded} />
    </div>
  );

  const renderSQLButtons = () => (
    <div className={styles.sqlButtons}>
      <Stack direction="row" gap={1} alignItems="center" justifyContent="end">
        <Button icon="play" onClick={executeQuery} size="sm">
          {t('expressions.sql-expr.button-run-query', 'Run query')}
        </Button>
        <Suspense fallback={null}>
          {shouldShowViewExplanation ? (
            <Button
              fill="outline"
              icon="gf-movepane-right"
              onClick={handleOpenExplanation}
              size="sm"
              variant="secondary"
            >
              <Trans i18nKey="sql-expressions.view-explanation">View explanation</Trans>
            </Button>
          ) : (
            <GenAISQLExplainButton
              currentQuery={query.expression || ''}
              onExplain={handleExplain}
              queryContext={queryContext}
              refIds={vars}
              // schemas={schemas} // Will be added when schema extraction is implemented
            />
          )}
        </Suspense>
        <Suspense fallback={null}>
          <GenAISQLSuggestionsButton
            currentQuery={query.expression || ''}
            initialQuery={initialQuery}
            onGenerate={() => {}} // Noop - history is managed via onHistoryUpdate
            onHistoryUpdate={handleHistoryUpdate}
            queryContext={queryContext}
            refIds={vars}
            errorContext={errorContext} // Will be added when error tracking is implemented
            // schemas={schemas} // Will be added when schema extraction is implemented
          />
        </Suspense>
      </Stack>
      {suggestions.length > 0 && (
        <Suspense fallback={null}>
          <SuggestionsDrawerButton handleOpenDrawer={handleOpenDrawer} suggestions={suggestions} />
        </Suspense>
      )}
    </div>
  );

  const renderSQLEditor = (width?: number, height?: number) => (
    <>
      <div className={styles.sqlContainer}>
        {renderSQLButtons()}
        <div ref={containerRef} className={styles.editorContainer}>
          <SQLEditor
            query={query.expression || initialQuery}
            onChange={onEditorChange}
            width={width}
            height={height ?? dimensions.height - EDITOR_BORDER_ADJUSTMENT - toolboxMeasure.height}
            language={EDITOR_LANGUAGE_DEFINITION}
          >
            {({ formatQuery }) => renderToolbox(formatQuery)}
          </SQLEditor>
        </div>
      </div>
      <Suspense fallback={null}>
        <GenAISuggestionsDrawer
          isOpen={isDrawerOpen}
          onApplySuggestion={onApplySuggestion}
          onClose={handleCloseDrawer}
          suggestions={suggestions}
        />
      </Suspense>
      <Suspense fallback={null}>
        <GenAIExplanationDrawer isOpen={isExplanationOpen} onClose={handleCloseExplanation} explanation={explanation} />
      </Suspense>
    </>
  );

  const renderStandaloneEditor = () => (
    <AutoSizer>
      {({ width, height }) => (
        <SQLEditor
          query={query.expression || initialQuery}
          onChange={onEditorChange}
          width={width}
          height={height ? height - EDITOR_BORDER_ADJUSTMENT - toolboxMeasure.height : undefined}
          language={EDITOR_LANGUAGE_DEFINITION}
        >
          {({ formatQuery }) => renderToolbox(formatQuery)}
        </SQLEditor>
      )}
    </AutoSizer>
  );

  return (
    <>
      {renderSQLEditor()}
      {isExpanded && (
        <Modal
          title={t('expressions.sql-expr.modal-title', 'SQL Editor')}
          closeOnBackdropClick={false}
          closeOnEscape={false}
          className={styles.modal}
          contentClassName={styles.modalContent}
          isOpen={isExpanded}
          onDismiss={() => setIsExpanded(false)}
        >
          {renderStandaloneEditor()}
        </Modal>
      )}
    </>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  sqlContainer: css({
    display: 'grid',
    gridTemplateRows: 'auto 1fr',
    gridTemplateAreas: `
      "buttons"
      "editor"
    `,
    gap: theme.spacing(0.5),
  }),
  editorContainer: css({
    gridArea: 'editor',
    height: '240px',
    resize: 'vertical',
    overflow: 'auto',
    minHeight: '100px',
  }),
  modal: css({
    width: '95vw',
    height: '95vh',
  }),
  modalContent: css({
    height: '100%',
    paddingTop: 0,
  }),
  // This is NOT ideal. The alternative is to expose SQL buttons as a separate component,
  // Then consume them in ExpressionQueryEditor. This requires a lot of refactoring and
  // can be prioritized later.
  sqlButtons: css({
    gridArea: 'buttons',
    justifySelf: 'end',
    transform: `translateY(${theme.spacing(-4)})`,
    marginBottom: theme.spacing(-4), // Prevent affecting editor position
    zIndex: 10, // Ensure buttons appear above other elements
    position: 'relative', // Required for z-index to work
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
  }),
});

async function fetchFields(identifier: TableIdentifier, queries: DataQuery[]) {
  const fields = await fetchSQLFields({ table: identifier.table }, queries);
  return fields.map((t) => ({ name: t.name, completion: t.value, kind: CompletionItemKind.Field }));
}
