import { css } from '@emotion/css';
import { useMemo, useRef, useEffect, useState, lazy, Suspense } from 'react';

import { SelectableValue } from '@grafana/data';
import { Trans } from '@grafana/i18n';
import { SQLEditor, LanguageDefinition } from '@grafana/plugin-ui';
import { config } from '@grafana/runtime';
import { useStyles2, Stack, Button, Text } from '@grafana/ui';

import { SqlExpressionQuery } from '../types';

import { AISuggestionsDrawer } from './AISuggestionsDrawer';

// Lazy load the GenAI component to avoid circular dependencies
const GenAISQLSuggestionsButton = lazy(() =>
  import('./GenAISQLSuggestionsButton').then((module) => ({
    default: module.GenAISQLSuggestionsButton,
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
}

export const SqlExpr = ({ onChange, refIds, query, alerting = false }: Props) => {
  const vars = useMemo(() => refIds.map((v) => v.value!), [refIds]);
  const initialQuery = `SELECT *
  FROM ${vars[0]}
  LIMIT 10`;

  const styles = useStyles2(getStyles);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ height: 0 });
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  const onEditorChange = (expression: string) => {
    onChange({
      ...query,
      expression,
      format: alerting ? 'alerting' : undefined,
    });
  };

  const onHistoryUpdate = (history: string[]) => {
    setSuggestions(history);
    // Auto-open drawer when first suggestion is generated
    if (history.length === 1) {
      setIsDrawerOpen(true);
    }
  };

  const onApplySuggestion = (suggestion: string) => {
    onEditorChange(suggestion);
    setIsDrawerOpen(false);
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
    <Stack direction="column" gap={1}>
      {config.featureToggles.dashgpt && (
        <Stack direction="row" gap={1} alignItems="center" justifyContent="end">
          <Suspense fallback={null}>
            <GenAISQLSuggestionsButton
              currentQuery={query.expression || ''}
              onGenerate={() => {}} // Noop - history is managed via onHistoryUpdate
              onHistoryUpdate={onHistoryUpdate}
              refIds={vars}
            />
          </Suspense>
          {suggestions.length > 0 && (
            <Button variant="secondary" size="sm" onClick={() => setIsDrawerOpen(true)} icon="list-ul">
              <Stack direction="row" gap={1} alignItems="center">
                <Trans i18nKey="sql-expressions.show-suggestions">AI Suggestions</Trans>
                {suggestions.length > 0 && (
                  <Text variant="bodySmall" weight="bold">
                    {suggestions.length}
                  </Text>
                )}
              </Stack>
            </Button>
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

      <AISuggestionsDrawer
        isOpen={isDrawerOpen}
        onApplySuggestion={onApplySuggestion}
        onClose={() => setIsDrawerOpen(false)}
        suggestions={suggestions}
      />
    </Stack>
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
