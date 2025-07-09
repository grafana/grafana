/**
 * Configuration file for SQL AI prompts used across expression components
 */

// Common SQL context information shared across all prompts
const COMMON_SQL_CONTEXT = {
  dialectInfo:
    'The SQL syntax is MySQL dialectic, based on dolthub go-mysql-server, use this when building and interpreting queries',
  refIdExplanation: 'RefIDs (A, B, C, etc.) represent data from other queries',
} as const;

// Template placeholders used in prompts
const TEMPLATE_PLACEHOLDERS = {
  refIds: '{refIds}',
  currentQuery: '{currentQuery}',
  queryInstruction: '{queryInstruction}',
} as const;

/**
 * System prompt for SQL suggestion generation
 */
const SQL_SUGGESTION_SYSTEM_PROMPT = `You are a SQL expert for Grafana expressions.

Help users with SQL queries by:
- Fixing syntax errors in existing queries
- Suggesting new queries using available RefIDs (A, B, C, etc.)
- Optimizing for performance

Guidelines:
- ${COMMON_SQL_CONTEXT.dialectInfo}
- Use RefIDs as table names in FROM clauses
- Include LIMIT clauses for performance
- Generate clean, readable SQL
- Focus on time series data patterns

Available RefIDs: ${TEMPLATE_PLACEHOLDERS.refIds}
Current query: ${TEMPLATE_PLACEHOLDERS.currentQuery}

${TEMPLATE_PLACEHOLDERS.queryInstruction}`;

/**
 * System prompt for SQL explanation generation
 */
const SQL_EXPLANATION_SYSTEM_PROMPT = `You are an expert in SQL and Grafana SQL expressions.

${COMMON_SQL_CONTEXT.dialectInfo}

Explain SQL queries clearly and concisely. ${COMMON_SQL_CONTEXT.refIdExplanation}.

Available RefIDs: ${TEMPLATE_PLACEHOLDERS.refIds}

Provide a clear explanation of what this SQL query does:`;

/**
 * Generate the complete system prompt for SQL suggestions with interpolated variables
 */
export const getSQLSuggestionSystemPrompt = (variables: {
  refIds: string;
  currentQuery: string;
  queryInstruction: string;
}): string => {
  return SQL_SUGGESTION_SYSTEM_PROMPT.replace(TEMPLATE_PLACEHOLDERS.refIds, variables.refIds)
    .replace(TEMPLATE_PLACEHOLDERS.currentQuery, variables.currentQuery)
    .replace(TEMPLATE_PLACEHOLDERS.queryInstruction, variables.queryInstruction);
};

/**
 * Generate the complete system prompt for SQL explanations with interpolated variables
 */
export const getSQLExplanationSystemPrompt = (variables: { refIds: string }): string => {
  return SQL_EXPLANATION_SYSTEM_PROMPT.replace(TEMPLATE_PLACEHOLDERS.refIds, variables.refIds);
};
