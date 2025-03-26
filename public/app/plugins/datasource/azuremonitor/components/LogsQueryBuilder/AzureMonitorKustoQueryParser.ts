import {
  BuilderQueryEditorExpressionType,
  BuilderQueryEditorOrderByExpressionArray,
  BuilderQueryEditorWhereExpressionArray,
  BuilderQueryExpression,
} from '../../dataquery.gen';
import { AzureLogAnalyticsMetadataColumn } from '../../types';

const getDatetimeColumn = (columns: AzureLogAnalyticsMetadataColumn[]): string => {
  return columns.find((col) => col.type === 'datetime')?.name || 'TimeGenerated';
};

const shouldApplyTimeFilter = (datetimeColumn: string, where?: BuilderQueryEditorWhereExpressionArray): boolean => {
  const hasTimeFilter = where?.expressions?.some((exp) => exp.property?.name === datetimeColumn);
  return !hasTimeFilter;
};

const appendFrom = (selectedTable: string, phrases: string[]) => {
  phrases.push(selectedTable);
};

const appendWhere = (
  selectedColumns: string[],
  filters: string | undefined,
  datetimeColumn: string,
  shouldApplyTimeFilter: boolean,
  columns: AzureLogAnalyticsMetadataColumn[],
  phrases: string[],
  where: BuilderQueryEditorWhereExpressionArray | undefined
) => {
  const whereConditions = new Set<string>();

  if (shouldApplyTimeFilter) {
    whereConditions.add(`$__timeFilter(${datetimeColumn})`);
  }

  if (filters) {
    const validFilters = filters.split(' and ').filter((filter) => {
      const filterColumn = filter.split(' ')[0];
      return selectedColumns.includes(filterColumn) || columns.some((col) => col.name === filterColumn);
    });
    validFilters.forEach((filter) => whereConditions.add(filter));
  }

  where?.expressions?.forEach((condition) => {
    if (condition.type === BuilderQueryEditorExpressionType.Operator) {
      const { operator, property } = condition;
      if (operator?.name && operator?.value && property?.name) {
        let operatorValue = String(operator.value).trim();
        if (
          (operatorValue.startsWith("'") && operatorValue.endsWith("'")) ||
          (operatorValue.startsWith('"') && operatorValue.endsWith('"'))
        ) {
          operatorValue = operatorValue.slice(1, -1);
        }
        const newCondition = `${property.name} ${operator.name} '${operatorValue}'`;
        whereConditions.add(newCondition);
      }
    }
  });

  if (whereConditions.size > 0) {
    phrases.push(`where ${Array.from(whereConditions).join(' and ')}`);
  }
};

const appendProject = (selectedColumns: string[], phrases: string[]) => {
  if (selectedColumns.length > 0) {
    if (selectedColumns.includes('TimeGenerated') && !phrases.some((p) => p.includes('$__timeFilter'))) {
      phrases.splice(1, 0, `where $__timeFilter(TimeGenerated)`);
    }
    phrases.push(`project ${selectedColumns.join(', ')}`);
  }
};

const appendSummarize = (
  selectedColumns: string[],
  aggregation: string | undefined,
  groupBy: string[] | undefined,
  phrases: string[]
) => {
  const hasValidAggregation = !!(aggregation && aggregation.trim());
  const summarizeAlreadyAdded = phrases.some((phrase) => phrase.startsWith('summarize'));
  const groupByParts = new Set<string>(groupBy);

  if (groupBy && groupBy.length > 0) {
    if (hasValidAggregation) {
      if (aggregation.startsWith('percentile')) {
        const percentileValue = selectedColumns.includes('percentileParam') ? 15 : undefined;
        const column = selectedColumns.includes('percentileColumn');
        phrases.push(`summarize ${aggregation}(${percentileValue}, ${column})`);
      } else if (!summarizeAlreadyAdded) {
        phrases.push(`summarize ${aggregation} by ${Array.from(groupByParts).join(', ')}`);
      }
    } else if (!summarizeAlreadyAdded) {
      phrases.push(`summarize by ${Array.from(groupByParts).join(', ')}`);
    }
  } else if (hasValidAggregation && !summarizeAlreadyAdded) {
    phrases.push(`summarize ${aggregation}`);
  }
};

const appendOrderBy = (
  phrases: string[],
  orderBy?: BuilderQueryEditorOrderByExpressionArray,
  aggregation?: string,
  selectedColumns?: string[],
  filters?: string
) => {
  if (aggregation || !orderBy?.expressions?.length) {
    return;
  }

  const isOnlyTableSelected = !selectedColumns?.length && !filters && !aggregation && !orderBy?.expressions?.length;
  if (isOnlyTableSelected) {
    return;
  }

  const orderClauses = orderBy.expressions.map((order) => `${order.property?.name} ${order.order}`).filter(Boolean);
  if (orderClauses.length > 0) {
    phrases.push(`order by ${orderClauses.join(', ')}`);
  }
};

const appendLimit = (limit: number | undefined, phrases: string[]) => {
  if (limit && limit > 0) {
    phrases.push(`limit ${limit}`);
  }
};

const toQuery = (
  builderQuery: BuilderQueryExpression,
  allColumns: AzureLogAnalyticsMetadataColumn[],
  aggregation?: string,
  filters?: string
): string => {
  const { from, columns, groupBy, limit, where, orderBy } = builderQuery;

  if (!from?.property?.name) {
    return '';
  }

  const selectedTable = from.property.name;
  const selectedColumns = columns?.columns || [];
  const phrases: string[] = [];
  const datetimeColumn = getDatetimeColumn(allColumns);
  const shouldTimeFilter = shouldApplyTimeFilter(datetimeColumn, where);
  const groupByStrings = groupBy?.expressions?.map((exp) => exp.property.name) || [];

  appendFrom(selectedTable, phrases);
  appendWhere(selectedColumns, filters, datetimeColumn, shouldTimeFilter, allColumns, phrases, where);
  appendProject(selectedColumns, phrases);
  appendSummarize(selectedColumns, aggregation, groupByStrings, phrases);
  appendOrderBy(phrases, orderBy, aggregation, selectedColumns, filters);
  appendLimit(limit, phrases);

  return phrases.join('\n| ');
};

export const AzureMonitorKustoQueryParser = {
  toQuery,
};
