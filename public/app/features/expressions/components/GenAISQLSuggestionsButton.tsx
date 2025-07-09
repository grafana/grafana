import { useCallback } from 'react';

import { t } from '@grafana/i18n';

import { GenAIButton } from '../../dashboard/components/GenAI/GenAIButton';
import { EventTrackingSrc } from '../../dashboard/components/GenAI/tracking';
import { Message, Role } from '../../dashboard/components/GenAI/utils';
import { getSQLSuggestionSystemPrompt, QueryUsageContext } from '../ai/sqlPromptConfig';

interface GenAISQLSuggestionsButtonProps {
  currentQuery: string;
  onGenerate: (suggestion: string) => void;
  onHistoryUpdate?: (history: string[]) => void;
  refIds: string[];
  initialQuery: string;
  schemas?: unknown; // Reserved for future schema implementation
  errorContext?: unknown; // Reserved for future error context implementation
  queryContext?: QueryUsageContext;
}

// AI prompts for different SQL use cases

const getContextualPrompts = (refIds: string[], currentQuery: string): string[] => {
  const trimmedQuery = currentQuery.trim();

  // If there's a current query, focus more on fixing/improving it
  if (trimmedQuery) {
    return [
      `Fix syntax errors in this SQL query: ${trimmedQuery}`,
      `Optimize this SQL query: ${trimmedQuery}`,
      `Improve this SQL query: ${trimmedQuery}`,
      `Join data from ${refIds.join(', ')} to correlate metrics`,
      `Aggregate data by time intervals`,
    ];
  }

  // If no current query, focus on suggestions
  return [
    `Join data from ${refIds.join(', ')} to correlate metrics`,
    `Aggregate data by time intervals`,
    `Filter data to identify outliers`,
    `Calculate percentiles from the data`,
    `Create time-based window functions`,
  ];
};

/**
 * Creates messages for the LLM to generate SQL suggestions
 *
 * @param refIds - The list of RefIDs available in the current context
 * @param currentQuery - The current SQL query being edited
 * @param schemas - Optional schema information (planned for future implementation)
 * @param errorContext - Optional error context for targeted fixes (planned for future implementation)
 * @param queryContext - Optional query usage context
 * @returns A list of messages to be sent to the LLM for generating SQL suggestions
 */
const getSQLSuggestionMessages = (
  refIds: string[],
  currentQuery: string,
  schemas?: unknown,
  errorContext?: unknown,
  queryContext?: QueryUsageContext
): Message[] => {
  const trimmedQuery = currentQuery.trim();
  const queryInstruction = trimmedQuery
    ? 'Focus on fixing, improving, or enhancing the current query provided above.'
    : 'Generate a new SQL query based on the available RefIDs and common use cases.';

  const systemPrompt = getSQLSuggestionSystemPrompt({
    refIds: refIds.length > 0 ? refIds.join(', ') : 'A',
    currentQuery: trimmedQuery || 'No current query provided',
    queryInstruction: queryInstruction,
    schemas, // Will be utilized once schema extraction is implemented
    errorContext, // Will be utilized once error tracking is implemented
    queryContext,
  });

  const contextualPrompts = getContextualPrompts(refIds, currentQuery);
  const selectedPrompt = contextualPrompts[Math.floor(Math.random() * contextualPrompts.length)];

  return [
    {
      role: Role.system,
      content: systemPrompt,
    },
    {
      role: Role.user,
      content: selectedPrompt,
    },
  ];
};

export const GenAISQLSuggestionsButton = ({
  currentQuery,
  onGenerate,
  onHistoryUpdate,
  refIds,
  initialQuery,
  schemas, // Future implementation will use this for enhanced context
  errorContext, // Will be utilized once error tracking is implemented
  queryContext,
}: GenAISQLSuggestionsButtonProps) => {
  const messages = useCallback(() => {
    return getSQLSuggestionMessages(refIds, currentQuery, schemas, errorContext, queryContext);
  }, [refIds, currentQuery, schemas, errorContext, queryContext]);

  const text = !currentQuery || currentQuery === initialQuery ? 'Generate suggestion' : 'Improve query';

  return (
    <GenAIButton
      disabled={refIds.length === 0}
      eventTrackingSrc={EventTrackingSrc.sqlExpressions}
      messages={messages}
      onGenerate={onGenerate}
      onHistoryChange={onHistoryUpdate}
      temperature={0.3}
      text={t('sql-expressions.sql-ai-interaction', `{{text}}`, { text })}
      timeout={15000} // 15 seconds
      toggleTipTitle={t('sql-expressions.ai-suggestions-title', 'AI-powered SQL expression suggestions')}
      tooltip={
        refIds.length === 0
          ? t('sql-expressions.add-query-tooltip', 'Add at least one data query to generate SQL suggestions')
          : undefined
      }
    />
  );
};
