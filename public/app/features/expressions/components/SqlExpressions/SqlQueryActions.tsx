import { t } from '@grafana/i18n';
import { Button, Stack } from '@grafana/ui';

import { AssistantSQLExplainButton, AssistantSQLSuggestionsButton } from './AssistantSQLButtons';
import { type QueryUsageContext } from './sqlExpressionContext';

export interface SqlQueryActionsProps {
  executeQuery: () => void;
  currentQuery: string;
  queryContext: QueryUsageContext;
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
  return (
    <Stack direction="row" gap={1} alignItems="center" justifyContent="start" wrap>
      <Button icon="play" onClick={executeQuery} size="sm">
        {t('expressions.sql-expr.button-run-query', 'Run query')}
      </Button>
      <AssistantSQLExplainButton currentQuery={currentQuery} refIds={refIds} queryContext={queryContext} />
      <AssistantSQLSuggestionsButton
        currentQuery={currentQuery}
        refIds={refIds}
        initialQuery={initialQuery}
        errorContext={errorContext}
        queryContext={queryContext}
      />
    </Stack>
  );
};
