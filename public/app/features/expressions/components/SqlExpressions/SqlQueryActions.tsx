import { t } from '@grafana/i18n';
import { Button, Stack } from '@grafana/ui';

import { AssistantSQLExplainButton, AssistantSQLSuggestionsButton } from './AssistantSQLButtons';
import { type SQLSchemas } from './hooks/useSQLSchemas';
import { type QueryUsageContext } from './sqlExpressionContext';

export interface SqlQueryActionsProps {
  executeQuery: () => void;
  currentQuery: string;
  queryContext: QueryUsageContext;
  refIds: string[];
  initialQuery: string;
  errorContext: string[];
  schemas: SQLSchemas | null;
}

export const SqlQueryActions = ({
  executeQuery,
  currentQuery,
  queryContext,
  refIds,
  initialQuery,
  errorContext,
  schemas,
}: SqlQueryActionsProps) => {
  return (
    <Stack direction="row" gap={1} alignItems="center" justifyContent="start" wrap>
      <Button icon="play" onClick={executeQuery} size="sm">
        {t('expressions.sql-expr.button-run-query', 'Run query')}
      </Button>
      <AssistantSQLExplainButton
        currentQuery={currentQuery}
        refIds={refIds}
        queryContext={queryContext}
        schemas={schemas}
      />
      <AssistantSQLSuggestionsButton
        currentQuery={currentQuery}
        refIds={refIds}
        initialQuery={initialQuery}
        errorContext={errorContext}
        queryContext={queryContext}
        schemas={schemas}
      />
    </Stack>
  );
};
