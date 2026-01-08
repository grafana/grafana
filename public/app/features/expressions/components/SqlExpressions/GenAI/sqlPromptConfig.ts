/**
 * Configuration file for SQL AI prompts used across expression components
 * NOTE: Schema and error context information integration is planned for future implementation
 */

import { DataQuery } from '@grafana/schema';

// Common SQL context information shared across all prompts
const COMMON_SQL_CONTEXT = {
  engineInfo: 'MySQL dialectic based on dolthub go-mysql-server. The tables are all in memory',
  refIdExplanation: 'RefIDs (A, B, C, etc.) represent data from other queries',
  columnInfo: 'value should always be represented as __value__',
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
  queries?: DataQuery[];
  dashboardContext?: {
    dashboardTitle?: string;
    panelName?: string;
  };
  datasources?: string[];
  totalRows?: number;
  requestTime?: number;
  numberOfQueries?: number;
  seriesData?: unknown;
}

/**
 * System prompt for SQL suggestion generation with enhanced context
 */
const SQL_SUGGESTION_SYSTEM_PROMPT = `You are a SQL expert for Grafana expressions specializing in time series data analysis.
IMPORTANT - Current SQL Errors (if any): ${TEMPLATE_PLACEHOLDERS.errorContext}

SQL dialect required by Grafana expressions: ${COMMON_SQL_CONTEXT.engineInfo}

RefIDs context: ${COMMON_SQL_CONTEXT.refIdExplanation}
Grafana specific context: ${COMMON_SQL_CONTEXT.columnInfo}

Available RefIDs to use in composable queries: ${TEMPLATE_PLACEHOLDERS.refIds}

Current query to be improved: ${TEMPLATE_PLACEHOLDERS.currentQuery}

Schema information to use in composable queries: ${TEMPLATE_PLACEHOLDERS.schemaInfo}

${TEMPLATE_PLACEHOLDERS.queryContext}

Query instruction: ${TEMPLATE_PLACEHOLDERS.queryInstruction}

You may be able to derive schema information from the series data in queryContext.

Given the above data, help users with their SQL query by:
- **PRIORITY: If there are errors listed above, focus on fixing them first**
- Fixing syntax errors using available field and data type information
- Suggesting optimal queries based on actual data schema and patterns.
- Look at query context stats: totalRows, requestTime, numberOfQueries, and if it looks like performance should be part of the conversation, suggest optimizing for performance. Note indexing is not supported in Grafana expressions.
- Leveraging time series patterns and Grafana-specific use cases

Guidelines:
- Use proper field names and types based on schema information
- Include LIMIT clauses for performance unless aggregating
- Consider time-based filtering and grouping for time series data
- Suggest meaningful aggregations for metric data
- Use appropriate JOIN conditions when correlating multiple RefIDs
`;

/**
 * System prompt for SQL explanation generation with enhanced context
 */
const SQL_EXPLANATION_SYSTEM_PROMPT = `You are an expert in SQL and Grafana SQL expressions with deep knowledge of time series data.

SQL dialect: ${COMMON_SQL_CONTEXT.engineInfo}

RefIDs: ${COMMON_SQL_CONTEXT.refIdExplanation}

Grafana specific context: ${COMMON_SQL_CONTEXT.columnInfo}

Available RefIDs: ${TEMPLATE_PLACEHOLDERS.refIds}

Schema: ${TEMPLATE_PLACEHOLDERS.schemaInfo}

${TEMPLATE_PLACEHOLDERS.queryContext}

Explain SQL queries clearly and concisely, focusing on:
- What data is being selected and from which RefIDs
- How the data is being transformed or aggregated
- The purpose and business meaning of the query using dashboard and panel name from query context if relevant
- Performance implications and optimization opportunities. Database columns can not be indexed in context of Grafana sql expressions. Don't focus on 
  performance unless the query context has a requestTime or totalRows that looks like it could benefit from it.
- Time series specific patterns and their significance

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
  if (queryContext.queries) {
    const queriesText = Array.isArray(queryContext.queries)
      ? JSON.stringify(queryContext.queries, null, 2)
      : String(queryContext.queries);
    contextParts.push(`Queries available to use in the SQL Expression: ${queriesText}`);
  }
  if (queryContext.dashboardContext) {
    const dashboardText =
      typeof queryContext.dashboardContext === 'object'
        ? JSON.stringify(queryContext.dashboardContext, null, 2)
        : String(queryContext.dashboardContext);
    contextParts.push(`Dashboard context (dashboard title and panel name): ${dashboardText}`);
  }
  if (queryContext.datasources) {
    const datasourcesText = Array.isArray(queryContext.datasources)
      ? JSON.stringify(queryContext.datasources, null, 2)
      : String(queryContext.datasources);
    contextParts.push(`Datasources available to use in the SQL Expression: ${datasourcesText}`);
  }
  if (queryContext.totalRows) {
    contextParts.push(`Total rows in the query: ${queryContext.totalRows}`);
  }
  if (queryContext.requestTime) {
    contextParts.push(`Request time: ${queryContext.requestTime}`);
  }
  if (queryContext.numberOfQueries) {
    contextParts.push(`Number of queries: ${queryContext.numberOfQueries}`);
  }
  if (queryContext.seriesData) {
    const seriesDataText =
      typeof queryContext.seriesData === 'object'
        ? JSON.stringify(queryContext.seriesData, null, 2)
        : String(queryContext.seriesData);
    contextParts.push(`Series data: ${seriesDataText}`);
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
  errorContext?: string[];
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
  const errorContext = variables.errorContext?.length
    ? variables.errorContext.join('\n')
    : 'No current errors detected.';

  return SQL_SUGGESTION_SYSTEM_PROMPT.replaceAll(TEMPLATE_PLACEHOLDERS.refIds, variables.refIds)
    .replaceAll(TEMPLATE_PLACEHOLDERS.currentQuery, variables.currentQuery)
    .replaceAll(TEMPLATE_PLACEHOLDERS.queryInstruction, variables.queryInstruction)
    .replaceAll(TEMPLATE_PLACEHOLDERS.schemaInfo, schemaInfo)
    .replaceAll(TEMPLATE_PLACEHOLDERS.errorContext, errorContext)
    .replaceAll(TEMPLATE_PLACEHOLDERS.queryContext, queryContext);
};

/**
 * Generate the complete system prompt for SQL explanations with enhanced context
 */
export const getSQLExplanationSystemPrompt = (variables: Omit<SQLPromptVariables, 'queryInstruction'>): string => {
  const queryContext = generateQueryContext(variables.queryContext);

  const schemaInfo = ''; // Placeholder for future schema information

  return SQL_EXPLANATION_SYSTEM_PROMPT.replaceAll(TEMPLATE_PLACEHOLDERS.refIds, variables.refIds)
    .replaceAll(TEMPLATE_PLACEHOLDERS.schemaInfo, schemaInfo)
    .replaceAll(TEMPLATE_PLACEHOLDERS.queryContext, queryContext);
};
