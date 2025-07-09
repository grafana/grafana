import { useCallback } from 'react';

import { t } from '@grafana/i18n';

import { GenAIButton } from '../../dashboard/components/GenAI/GenAIButton';
import { EventTrackingSrc } from '../../dashboard/components/GenAI/tracking';
import { Message, Role } from '../../dashboard/components/GenAI/utils';

interface GenAISQLSuggestionsButtonProps {
  currentQuery: string;
  onGenerate: (suggestion: string) => void;
  onHistoryUpdate?: (history: string[]) => void;
  refIds: string[];
  initialQuery: string;
}

// AI prompts for different SQL use cases
const SQL_EXPRESSION_SYSTEM_PROMPT = `You are a SQL expert for Grafana expressions.

Help users with SQL queries by:
- Fixing syntax errors in existing queries
- Suggesting new queries using available RefIDs (A, B, C, etc.)
- Optimizing for performance

Guidelines:
- Use RefIDs as table names in FROM clauses
- Include LIMIT clauses for performance
- Generate clean, readable SQL
- Focus on time series data patterns

Available RefIDs: {refIds}
Current query: {currentQuery}

{queryInstruction}`;

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
 * @param refIds - The list of RefIDs available in the current context
 * @param currentQuery - The current SQL query being edited
 * @returns A list of messages to be sent to the LLM for generating SQL suggestions
 *
 * The system prompt is a template that is replaced with the actual RefIDs and current query.
 * The contextual prompts are a list of prompts that are selected at random to be sent to the LLM.
 * The selected prompt is then sent to the LLM for generating SQL suggestions.
 */
const getSQLSuggestionMessages = (refIds: string[], currentQuery: string): Message[] => {
  const trimmedQuery = currentQuery.trim();
  const queryInstruction = trimmedQuery
    ? 'Focus on fixing, improving, or enhancing the current query provided above.'
    : 'Generate a new SQL query based on the available RefIDs and common use cases.';

  const systemPrompt = SQL_EXPRESSION_SYSTEM_PROMPT.replace('{refIds}', refIds.length > 0 ? refIds.join(', ') : 'A')
    .replace('{currentQuery}', trimmedQuery || 'No current query provided')
    .replace('{queryInstruction}', queryInstruction);

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
}: GenAISQLSuggestionsButtonProps) => {
  const messages = useCallback(() => {
    return getSQLSuggestionMessages(refIds, currentQuery);
  }, [refIds, currentQuery]);

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
      toggleTipTitle={t('sql-expressions.ai-suggestions-title', 'AI-powered SQL expression suggestions')}
      tooltip={
        refIds.length === 0
          ? t('sql-expressions.add-query-tooltip', 'Add at least one data query to generate SQL suggestions')
          : undefined
      }
    />
  );
};
