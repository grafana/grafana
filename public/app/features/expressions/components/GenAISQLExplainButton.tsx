import { useCallback } from 'react';

import { t } from '@grafana/i18n';

import { GenAIButton } from '../../dashboard/components/GenAI/GenAIButton';
import { EventTrackingSrc } from '../../dashboard/components/GenAI/tracking';
import { Message, Role } from '../../dashboard/components/GenAI/utils';

interface GenAISQLExplainButtonProps {
  currentQuery: string;
  onExplain: (explanation: string) => void;
  refIds: string[];
}

// AI prompt for explaining SQL expressions
const SQL_EXPRESSION_EXPLAIN_SYSTEM_PROMPT = `You are an expert in SQL and Grafana SQL expressions.

Explain SQL queries clearly and concisely. RefIDs (A, B, C, etc.) represent data from other queries.

Available RefIDs: {refIds}

Provide a clear explanation of what this SQL query does:`;

const getExplanationPrompt = (currentQuery: string): string => {
  if (!currentQuery || currentQuery.trim() === '') {
    return 'There is no SQL query to explain. Please enter a SQL expression first.';
  }

  return `${currentQuery}

Explain what this query does in simple terms.`;
};

/**
 * @param refIds - The list of RefIDs available in the current context
 * @param currentQuery - The current SQL query to explain
 * @returns A list of messages to be sent to the LLM for explaining the SQL query
 */
const getSQLExplanationMessages = (refIds: string[], currentQuery: string): Message[] => {
  const systemPrompt = SQL_EXPRESSION_EXPLAIN_SYSTEM_PROMPT.replace(
    '{refIds}',
    refIds.length > 0 ? refIds.join(', ') : 'A'
  );

  const userPrompt = getExplanationPrompt(currentQuery);

  return [
    {
      role: Role.system,
      content: systemPrompt,
    },
    {
      role: Role.user,
      content: userPrompt,
    },
  ];
};

export const GenAISQLExplainButton = ({ currentQuery, onExplain, refIds }: GenAISQLExplainButtonProps) => {
  const messages = useCallback(() => {
    return getSQLExplanationMessages(refIds, currentQuery);
  }, [refIds, currentQuery]);

  const hasQuery = currentQuery && currentQuery.trim() !== '';

  return (
    <GenAIButton
      disabled={!hasQuery}
      eventTrackingSrc={EventTrackingSrc.sqlExpressions}
      messages={messages}
      onGenerate={onExplain}
      temperature={0.3}
      text={t('sql-expressions.explain-query', 'Explain query')}
      toggleTipTitle={t('sql-expressions.ai-explain-title', 'AI-powered SQL expression explanation')}
      tooltip={
        !hasQuery
          ? t('sql-expressions.explain-empty-query-tooltip', 'Enter a SQL expression to get an explanation')
          : undefined
      }
    />
  );
};
