import { lazy, Suspense } from 'react';

import { t, Trans } from '@grafana/i18n';
import { Button, Stack } from '@grafana/ui';

import { useSqlExprContext } from './SqlExprContext';

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

export interface SqlQueryActionsProps {
  executeQuery: () => void;
  currentQuery: string;
  queryContext: Record<string, unknown>;
  refIds: string[];
  initialQuery: string;
  errorContext: string[];
}

export const SqlQueryActions = ({
  executeQuery,
  currentQuery,
  queryContext,
  refIds,
  initialQuery,
  errorContext,
}: SqlQueryActionsProps) => {
  const {
    handleOpenExplanation,
    shouldShowViewExplanation,
    handleExplain,
    handleHistoryUpdate,
    handleOpenDrawer,
    suggestions,
  } = useSqlExprContext();
  return (
    <Stack direction="row" gap={1} alignItems="center" justifyContent="start" wrap>
      <Button icon="play" onClick={executeQuery} size="sm">
        {t('expressions.sql-expr.button-run-query', 'Run query')}
      </Button>
      <Suspense fallback={null}>
        {shouldShowViewExplanation ? (
          <Button fill="outline" icon="gf-movepane-right" onClick={handleOpenExplanation} size="sm" variant="secondary">
            <Trans i18nKey="sql-expressions.view-explanation">View explanation</Trans>
          </Button>
        ) : (
          <GenAISQLExplainButton
            currentQuery={currentQuery}
            onExplain={handleExplain}
            queryContext={queryContext}
            refIds={refIds}
            // schemas={schemas} // Will be added when schema extraction is implemented
          />
        )}
      </Suspense>
      <Suspense fallback={null}>
        <GenAISQLSuggestionsButton
          currentQuery={currentQuery}
          initialQuery={initialQuery}
          onGenerate={() => {}} // Noop - history is managed via onHistoryUpdate
          onHistoryUpdate={handleHistoryUpdate}
          queryContext={queryContext}
          refIds={refIds}
          errorContext={errorContext} // Will be added when error tracking is implemented
          // schemas={schemas} // Will be added when schema extraction is implemented
        />
      </Suspense>
      {suggestions.length > 0 && (
        <Suspense fallback={null}>
          <SuggestionsDrawerButton handleOpenDrawer={handleOpenDrawer} suggestions={suggestions} />
        </Suspense>
      )}
    </Stack>
  );
};
