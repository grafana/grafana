import { css } from '@emotion/css';
import { useMemo, useRef, useEffect, useState, lazy, Suspense } from 'react';

import { SelectableValue } from '@grafana/data';
import { Trans } from '@grafana/i18n';
import { SQLEditor, LanguageDefinition } from '@grafana/plugin-ui';
import { config } from '@grafana/runtime';
import { useStyles2, Stack, Button } from '@grafana/ui';

import { QueryUsageContext } from '../ai/sqlPromptConfig';
import { SqlExpressionQuery } from '../types';

import { useSQLSuggestions, useSQLExplanations, GenAISuggestionsDrawer, GenAIExplanationDrawer } from './GenAI';
import { SuggestionsBadge } from './GenAI/SuggestionsBadge';

// Lazy load the GenAI components to avoid circular dependencies
const GenAISQLSuggestionsButton = lazy(() =>
  import('./GenAI').then((module) => ({
    default: module.GenAISQLSuggestionsButton,
  }))
);

const GenAISQLExplainButton = lazy(() =>
  import('./GenAI').then((module) => ({
    default: module.GenAISQLExplainButton,
  }))
);

// Account for Monaco editor's border to prevent clipping
const EDITOR_BORDER_ADJUSTMENT = 2; // 1px border on top and bottom

// Define the language definition for MySQL syntax highlighting and autocomplete
const EDITOR_LANGUAGE_DEFINITION: LanguageDefinition = {
  id: 'mysql',
  // Additional properties could be added here in the future if needed
  // eg:
  // completionProvider: to autocomplete field (ie column) names when given
  // a table name (dataframe reference)
  // formatter: to format the SQL query and dashboard variables
};

interface Props {
  refIds: Array<SelectableValue<string>>;
  query: SqlExpressionQuery;
  onChange: (query: SqlExpressionQuery) => void;
  /** Should the `format` property be set to `alerting`? */
  alerting?: boolean;
  panelId?: string;
}

export const SqlExpr = ({ onChange, refIds, query, alerting = false, panelId }: Props) => {
  const vars = useMemo(() => refIds.map((v) => v.value!), [refIds]);
  const initialQuery = `SELECT *
  FROM ${vars[0]}
  LIMIT 10`;

  const styles = useStyles2(getStyles);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ height: 0 });

  const {
    handleApplySuggestion,
    handleHistoryUpdate,
    handleCloseDrawer,
    handleOpenDrawer,
    isDrawerOpen,
    hasUnseenSuggestions,
    suggestions,
  } = useSQLSuggestions();

  const {
    explanation,
    handleCloseExplanation,
    handleOpenExplanation,
    handleExplain,
    isExplanationOpen,
    shouldShowViewExplanation,
    updatePrevExpression,
  } = useSQLExplanations(query.expression || '');

  const queryContext: QueryUsageContext = useMemo(() => ({ alerting, panelId }), [alerting, panelId]);

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

  return (
    <>
      <Stack direction="column" gap={1}>
        {config.featureToggles.sqlExpressions && (
          <Stack direction="row" gap={1} alignItems="center" justifyContent="end">
            <Stack direction="row" gap={1} alignItems="center" justifyContent="end">
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
                  // errorContext={errorContext} // Will be added when error tracking is implemented
                  // schemas={schemas} // Will be added when schema extraction is implemented
                />
              </Suspense>
            </Stack>
            {suggestions.length > 0 && (
              <SuggestionsBadge
                handleOpenDrawer={handleOpenDrawer}
                hasUnseenSuggestions={hasUnseenSuggestions}
                suggestions={suggestions}
              />
            )}
          </Stack>
        )}

        <div ref={containerRef} className={styles.editorContainer}>
          <SQLEditor
            query={query.expression || initialQuery}
            onChange={onEditorChange}
            height={dimensions.height - EDITOR_BORDER_ADJUSTMENT}
            language={EDITOR_LANGUAGE_DEFINITION}
          />
        </div>
      </Stack>
      <GenAISuggestionsDrawer
        isOpen={isDrawerOpen}
        onApplySuggestion={onApplySuggestion}
        onClose={handleCloseDrawer}
        suggestions={suggestions}
      />
      <GenAIExplanationDrawer isOpen={isExplanationOpen} onClose={handleCloseExplanation} explanation={explanation} />
    </>
  );
};

const getStyles = () => ({
  editorContainer: css({
    height: '240px',
    resize: 'vertical',
    overflow: 'auto',
    minHeight: '100px',
  }),
});
