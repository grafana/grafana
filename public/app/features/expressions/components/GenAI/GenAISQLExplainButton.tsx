import { useCallback } from 'react';

import { t } from '@grafana/i18n';

import { GenAIButton } from '../../../dashboard/components/GenAI/GenAIButton';
import { EventTrackingSrc } from '../../../dashboard/components/GenAI/tracking';
import { Message, Role } from '../../../dashboard/components/GenAI/utils';

import { getSQLExplanationSystemPrompt, QueryUsageContext } from './sqlPromptConfig';

interface GenAISQLExplainButtonProps {
  currentQuery: string;
  onExplain: (explanation: string) => void;
  refIds: string[];
  schemas?: unknown; // Reserved for future schema implementation
  queryContext?: QueryUsageContext;
}

// AI prompt for explaining SQL expressions

const getExplanationPrompt = (currentQuery: string): string => {
  if (!currentQuery || currentQuery.trim() === '') {
    return 'There is no SQL query to explain. Please enter a SQL expression first.';
  }

  return `${currentQuery}

Explain what this query does in simple terms.`;
};

/**
 * Creates messages for the LLM to explain SQL queries
 *
 * @param refIds - The list of RefIDs available in the current context
 * @param currentQuery - The current SQL query to explain
 * @param schemas - Optional schema information (planned for future implementation)
 * @param queryContext - Optional query usage context
 * @returns A list of messages to be sent to the LLM for explaining the SQL query
 */
const getSQLExplanationMessages = (
  refIds: string[],
  currentQuery: string,
  schemas?: unknown,
  queryContext?: QueryUsageContext
): Message[] => {
  const systemPrompt = getSQLExplanationSystemPrompt({
    refIds: refIds.length > 0 ? refIds.join(', ') : 'A',
    currentQuery: currentQuery.trim() || 'No current query provided',
    schemas, // Will be utilized once schema extraction is implemented
    queryContext,
  });

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

export const GenAISQLExplainButton = ({
  currentQuery,
  onExplain,
  queryContext,
  refIds,
  schemas, // Future implementation will use this for enhanced context
}: GenAISQLExplainButtonProps) => {
  const messages = useCallback(() => {
    return getSQLExplanationMessages(refIds, currentQuery, schemas, queryContext);
  }, [refIds, currentQuery, schemas, queryContext]);

  const hasQuery = currentQuery && currentQuery.trim() !== '';

  return (
    <GenAIButton
      disabled={!hasQuery}
      eventTrackingSrc={EventTrackingSrc.sqlExpressions}
      messages={messages}
      onGenerate={onExplain}
      temperature={0.3}
      text={t('sql-expressions.explain-query', 'Explain query')}
      timeout={60000} // 60 seconds
      toggleTipTitle={t('sql-expressions.ai-explain-title', 'AI-powered SQL expression explanation')}
      tooltip={
        !hasQuery
          ? t('sql-expressions.explain-empty-query-tooltip', 'Enter a SQL expression to get an explanation')
          : t(
              'expressions.sql-expr.tooltip-experimental',
              'SQL Expressions LLM integration is experimental. Please report any issues to the Grafana team.'
            )
      }
    />
  );
};
