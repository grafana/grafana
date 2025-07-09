/**
 * Configuration file for SQL AI prompts used across expression components
 * NOTE: Schema and error context information integration is planned for future implementation
 */

// Common SQL context information shared across all prompts
const COMMON_SQL_CONTEXT = {
  dialectInfo:
    'The SQL syntax is MySQL dialectic, based on dolthub go-mysql-server, use this when building and interpreting queries',
  refIdExplanation:
    'RefIDs (A, B, C, etc.) represent data from other queries and are used as table names in FROM clauses',
} as const;

// Template placeholders used in prompts
const TEMPLATE_PLACEHOLDERS = {
  refIds: '{refIds}',
  currentQuery: '{currentQuery}',
  queryInstruction: '{queryInstruction}',
  schemaInfo: '{schemaInfo}', // Note: Schema information will be implemented in future updates
  errorContext: '{errorContext}', // Note: Error context will be implemented in future updates
  queryContext: '{queryContext}',
} as const;

export interface QueryUsageContext {
  panelId?: string;
  alerting?: boolean;
}

/**
 * System prompt for SQL suggestion generation with enhanced context
 */
const SQL_SUGGESTION_SYSTEM_PROMPT = `You are a SQL expert for Grafana expressions specializing in time series data analysis.

Help users with SQL queries by:
- Fixing syntax errors using available field and data type information
- Suggesting optimal queries based on actual data schema and patterns
- Optimizing for performance with appropriate indexes and filtering
- Leveraging time series patterns and Grafana-specific use cases

Guidelines:
- ${COMMON_SQL_CONTEXT.dialectInfo}
- ${COMMON_SQL_CONTEXT.refIdExplanation}
- Use proper field names and types based on schema information
- Include LIMIT clauses for performance unless aggregating
- Consider time-based filtering and grouping for time series data
- Suggest meaningful aggregations (AVG, SUM, COUNT, etc.) for metric data
- Use appropriate JOIN conditions when correlating multiple RefIDs

${TEMPLATE_PLACEHOLDERS.schemaInfo}

${TEMPLATE_PLACEHOLDERS.errorContext}

${TEMPLATE_PLACEHOLDERS.queryContext}

Available RefIDs: ${TEMPLATE_PLACEHOLDERS.refIds}
Current query: ${TEMPLATE_PLACEHOLDERS.currentQuery}

${TEMPLATE_PLACEHOLDERS.queryInstruction}`;

/**
 * System prompt for SQL explanation generation with enhanced context
 */
const SQL_EXPLANATION_SYSTEM_PROMPT = `You are an expert in SQL and Grafana SQL expressions with deep knowledge of time series data.

${COMMON_SQL_CONTEXT.dialectInfo}

Explain SQL queries clearly and concisely, focusing on:
- What data is being selected and from which RefIDs
- How the data is being transformed or aggregated
- The purpose and business meaning of the query
- Performance implications and optimization opportunities
- Time series specific patterns and their significance

${COMMON_SQL_CONTEXT.refIdExplanation}

${TEMPLATE_PLACEHOLDERS.schemaInfo}

${TEMPLATE_PLACEHOLDERS.queryContext}

Available RefIDs: ${TEMPLATE_PLACEHOLDERS.refIds}

Provide a clear explanation of what this SQL query does:`;

/**
 * Generate query context text for prompts
 */
const generateQueryContext = (queryContext?: QueryUsageContext): string => {
  if (!queryContext) {
    return '';
  }

  const contextParts = [];
  if (queryContext.panelId) {
    contextParts.push(
      `Panel Type: ${queryContext.panelId}. Please use this to generate suggestions that are relevant to the panel type.`
    );
  }
  if (queryContext.alerting) {
    contextParts.push(
      'Context: Alerting rule (focus on boolean/threshold results). Please use this to generate suggestions that are relevant to the alerting rule.'
    );
  }

  return contextParts.length
    ? `Query Context:
${contextParts.join('\n')}`
    : '';
};

/**
 * Enhanced interface for prompt generation variables
 */
export interface SQLPromptVariables {
  refIds: string;
  currentQuery: string;
  queryInstruction: string;
  schemas?: unknown; // Reserved for future schema implementation
  errorContext?: unknown; // Reserved for future error context implementation
  queryContext?: QueryUsageContext;
}

/**
 * Generate the complete system prompt for SQL suggestions with enhanced context
 *
 * Note: Schema information integration is planned for future implementation
 */
export const getSQLSuggestionSystemPrompt = (variables: SQLPromptVariables): string => {
  const queryContext = generateQueryContext(variables.queryContext);
  const schemaInfo = ''; // Placeholder for future schema information
  const errorContext = ''; // Placeholder for future error context information

  return SQL_SUGGESTION_SYSTEM_PROMPT.replace(TEMPLATE_PLACEHOLDERS.refIds, variables.refIds)
    .replace(TEMPLATE_PLACEHOLDERS.currentQuery, variables.currentQuery)
    .replace(TEMPLATE_PLACEHOLDERS.queryInstruction, variables.queryInstruction)
    .replace(TEMPLATE_PLACEHOLDERS.schemaInfo, schemaInfo)
    .replace(TEMPLATE_PLACEHOLDERS.errorContext, errorContext)
    .replace(TEMPLATE_PLACEHOLDERS.queryContext, queryContext);
};

/**
 * Generate the complete system prompt for SQL explanations with enhanced context
 */
export const getSQLExplanationSystemPrompt = (variables: Omit<SQLPromptVariables, 'queryInstruction'>): string => {
  const queryContext = generateQueryContext(variables.queryContext);

  const schemaInfo = ''; // Placeholder for future schema information

  return SQL_EXPLANATION_SYSTEM_PROMPT.replace(TEMPLATE_PLACEHOLDERS.refIds, variables.refIds)
    .replace(TEMPLATE_PLACEHOLDERS.schemaInfo, schemaInfo)
    .replace(TEMPLATE_PLACEHOLDERS.queryContext, queryContext);
};
