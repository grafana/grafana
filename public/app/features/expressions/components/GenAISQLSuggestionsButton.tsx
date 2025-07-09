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
}

// AI prompts for different SQL use cases
const SQL_EXPRESSION_SYSTEM_PROMPT = `You are an expert in SQL and Grafana SQL expressions.

Your role is to generate intelligent SQL queries for Grafana SQL expressions based on:
1. Available data queries (RefIDs like A, B, C) that act as table references
2. Current query context and user intent
3. Common time series data patterns in monitoring/observability

Key guidelines:
- Use RefIDs (A, B, C, etc.) as table names in FROM clauses
- Focus on practical data transformation and analysis patterns
- Consider time series data conventions (time, __value__, metric_name, display_name columns)
- Include proper LIMIT clauses for performance
- Generate clean, readable SQL with proper formatting
- Support JOINs, aggregations, filtering, and transformations
- Include helpful comments when query is complex

Available RefIDs: {refIds}
Current query: {currentQuery}

Generate a useful SQL expression that transforms or analyzes the available data.`;

const getContextualPrompts = (refIds: string[], currentQuery: string): string[] => {
  const basePrompts = [
    `Generate a SQL query that joins data from multiple queries (${refIds.join(', ')}) to correlate metrics`,
    `Create a SQL query that aggregates and groups data by time intervals for trending analysis`,
    `Write a SQL query that filters and transforms data to identify anomalies or outliers`,
    `Generate a SQL query that calculates percentiles, ratios, or derived metrics from the source data`,
    `Create a SQL query with Common Table Expressions (CTEs) for complex data transformations`,
  ];

  if (currentQuery.trim()) {
    basePrompts.unshift(`Improve or enhance this existing SQL query: ${currentQuery}`);
  }

  return basePrompts;
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
  const systemPrompt = SQL_EXPRESSION_SYSTEM_PROMPT.replace(
    '{refIds}',
    refIds.length > 0 ? refIds.join(', ') : 'A'
  ).replace('{currentQuery}', currentQuery || 'No current query');

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
}: GenAISQLSuggestionsButtonProps) => {
  const messages = useCallback(() => {
    return getSQLSuggestionMessages(refIds, currentQuery);
  }, [refIds, currentQuery]);

  return (
    <GenAIButton
      disabled={refIds.length === 0}
      eventTrackingSrc={EventTrackingSrc.sqlExpressions}
      messages={messages}
      onGenerate={onGenerate}
      onHistoryChange={onHistoryUpdate}
      temperature={0.3}
      text={t('sql-expressions.generate-sql-suggestion', 'Generate SQL Suggestion')}
      toggleTipTitle={t('sql-expressions.ai-suggestions-title', 'AI-powered SQL expression suggestions')}
      tooltip={
        refIds.length === 0
          ? t('sql-expressions.add-query-tooltip', 'Add at least one data query to generate SQL suggestions')
          : undefined
      }
    />
  );
};
