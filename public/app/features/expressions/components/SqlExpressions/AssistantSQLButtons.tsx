import { useMemo } from 'react';

import { OpenAssistantButton, createAssistantContextItem } from '@grafana/assistant';
import { t } from '@grafana/i18n';

import { type SQLSchemas } from './hooks/useSQLSchemas';
import { type QueryUsageContext } from './sqlExpressionContext';

interface AssistantSQLExplainButtonProps {
  currentQuery: string;
  refIds: string[];
  queryContext?: QueryUsageContext;
  schemas?: SQLSchemas | null;
}

export const AssistantSQLExplainButton = ({
  currentQuery,
  refIds,
  queryContext,
  schemas,
}: AssistantSQLExplainButtonProps) => {
  const hasQuery = currentQuery.trim() !== '';

  const context = useMemo(
    () => buildSQLContext({ refIds, currentQuery, queryContext, schemas }),
    [refIds, currentQuery, queryContext, schemas]
  );

  const prompt = hasQuery
    ? `Explain this SQL expression query:\n\`\`\`sql\n${currentQuery}\n\`\`\``
    : 'There is no SQL query to explain. Please enter a SQL expression first.';

  return (
    <OpenAssistantButton
      origin="grafana/expressions/sql/explain"
      prompt={prompt}
      context={context}
      title={t('sql-expressions.explain-query', 'Explain query')}
      size="sm"
    />
  );
};

interface AssistantSQLSuggestionsButtonProps {
  currentQuery: string;
  refIds: string[];
  initialQuery: string;
  errorContext?: string[];
  queryContext?: QueryUsageContext;
  schemas?: SQLSchemas | null;
}

export const AssistantSQLSuggestionsButton = ({
  currentQuery,
  refIds,
  initialQuery,
  errorContext,
  queryContext,
  schemas,
}: AssistantSQLSuggestionsButtonProps) => {
  const trimmedQuery = currentQuery.trim();
  const hasQuery = trimmedQuery !== '';
  const isImprove = hasQuery && currentQuery !== initialQuery;

  const context = useMemo(
    () => buildSQLContext({ refIds, currentQuery, errorContext, queryContext, schemas }),
    [refIds, currentQuery, errorContext, queryContext, schemas]
  );

  // Cannot generate suggestions without source queries to reference
  if (!hasQuery && refIds.length === 0) {
    return null;
  }

  const prompt = hasQuery
    ? `Improve, fix syntax errors, or optimize this SQL expression query:\n\`\`\`sql\n${trimmedQuery}\n\`\`\``
    : `Generate a SQL expression query using data from ${refIds.join(', ')}. Suggest common patterns like joins, aggregations, filtering, percentiles, or time-based window functions.`;

  const buttonText = isImprove
    ? t('sql-expressions.improve-query', 'Improve query')
    : t('sql-expressions.generate-suggestion', 'Generate suggestion');

  return (
    <OpenAssistantButton
      origin="grafana/expressions/sql/improve"
      prompt={prompt}
      context={context}
      title={buttonText}
      size="sm"
    />
  );
};

interface BuildSQLContextParams {
  refIds: string[];
  currentQuery: string;
  errorContext?: string[];
  queryContext?: QueryUsageContext;
  schemas?: SQLSchemas | null;
}

function buildSQLContext({ refIds, currentQuery, errorContext, queryContext, schemas }: BuildSQLContextParams) {
  return [
    createAssistantContextItem('structured', {
      hidden: true,
      // eslint-disable-next-line @grafana/i18n/no-untranslated-strings -- hidden context for the LLM, not shown to users
      title: 'SQL Expression Context',
      data: {
        sqlDialect: 'MySQL dialect based on dolthub go-mysql-server. All tables are in memory.',
        availableRefIds: refIds,
        refIdExplanation:
          'RefIDs (A, B, C, etc.) represent data from other queries that can be used as table names in SQL',
        columnInfo: 'The value column should always be referenced as __value__',
        currentQuery: currentQuery.trim() || undefined,
        errors: errorContext?.length ? errorContext : undefined,
        ...formatSchemas(schemas),
        ...formatQueryContext(queryContext),
      },
    }),
  ];
}

/**
 * Formats schema column metadata into a compact representation for Grafana Assistant.
 * Only includes column definitions (name, type, nullable) — sample rows are omitted
 * to keep context size small.
 */
function formatSchemas(schemas?: SQLSchemas | null): Record<string, unknown> {
  if (!schemas) {
    return {};
  }

  const tableSchemas: Record<string, unknown> = {};
  for (const [refId, schema] of Object.entries(schemas)) {
    if (schema.columns?.length) {
      tableSchemas[refId] = schema.columns.map((col) => ({
        name: col.name,
        type: col.mysqlType,
        nullable: col.nullable,
      }));
    }
  }

  if (Object.keys(tableSchemas).length === 0) {
    return {};
  }

  return { tableSchemas };
}

function formatQueryContext(queryContext?: QueryUsageContext): Record<string, unknown> {
  if (!queryContext) {
    return {};
  }

  const result: Record<string, unknown> = {};

  if (queryContext.alerting) {
    result.usageContext = 'alerting rule (focus on boolean/threshold results)';
  }
  if (queryContext.panelId) {
    result.panelType = queryContext.panelId;
  }
  if (queryContext.dashboardContext?.dashboardTitle || queryContext.dashboardContext?.panelName) {
    result.dashboardContext = queryContext.dashboardContext;
  }
  if (queryContext.datasources?.length) {
    result.datasources = queryContext.datasources;
  }
  if (queryContext.queries?.length) {
    result.siblingQueries = queryContext.queries;
  }
  if (queryContext.totalRows != null) {
    result.totalRows = queryContext.totalRows;
  }
  if (queryContext.requestTime != null && queryContext.requestTime >= 0) {
    result.requestTimeMs = queryContext.requestTime;
  }
  if (queryContext.numberOfQueries != null) {
    result.numberOfQueries = queryContext.numberOfQueries;
  }

  return result;
}
