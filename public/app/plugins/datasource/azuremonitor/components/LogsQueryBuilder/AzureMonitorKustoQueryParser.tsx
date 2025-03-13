import {
  BuilderQueryEditorExpressionType,
  BuilderQueryEditorWhereArrayExpression,
  BuilderQueryExpression,
} from '../../dataquery.gen';
import { AzureLogAnalyticsMetadataColumn } from '../../types';

export class AzureMonitorKustoQueryParser {
  constructor() {}

  static toQuery(
    builderQuery: BuilderQueryExpression,
    allColumns: AzureLogAnalyticsMetadataColumn[],
    aggregation?: string,
    filters?: string
  ): string {
    const { from, columns, groupBy, limit, where } = builderQuery;

    if (!from || !from.property.name) {
      return '';
    }

    const selectedTable = from.property.name;
    const selectedColumns = columns?.columns || [];
    const parts: string[] = [];
    const datetimeColumn = this.getDatetimeColumn(allColumns);
    const shouldApplyTimeFilter = this.shouldApplyTimeFilter(selectedColumns, datetimeColumn);
    const groupByStrings = groupBy?.expressions?.map((expression) => expression.property.name) || [];

    this.appendFrom(selectedTable, parts);
    this.appendWhere(selectedColumns, filters, datetimeColumn, shouldApplyTimeFilter, allColumns, parts, where);
    this.appendProject(selectedColumns, parts);
    this.appendSummarize(selectedColumns, aggregation, groupByStrings, datetimeColumn, parts);
    this.appendOrderBy(datetimeColumn, selectedColumns, groupByStrings, parts, aggregation);
    this.appendLimit(limit, parts);

    return parts.join('\n| ');
  }

  private static getDatetimeColumn(columns: AzureLogAnalyticsMetadataColumn[]): string {
    return columns.find((col) => col.type === 'datetime')?.name || 'TimeGenerated';
  }

  private static shouldApplyTimeFilter(selectedColumns: string[], datetimeColumn: string): boolean {
    return selectedColumns.length === 0 || selectedColumns.includes(datetimeColumn);
  }

  private static appendFrom(selectedTable: string, parts: string[]) {
    parts.push(selectedTable);
  }

  private static appendWhere(
    selectedColumns: string[],
    filters: string | undefined,
    datetimeColumn: string,
    shouldApplyTimeFilter: boolean,
    columns: AzureLogAnalyticsMetadataColumn[],
    parts: string[],
    where: BuilderQueryEditorWhereArrayExpression | undefined
  ) {
    const whereConditions = new Set<string>();

    if (shouldApplyTimeFilter && !whereConditions.has(`$__timeFilter(${datetimeColumn})`)) {
      whereConditions.add(`$__timeFilter(${datetimeColumn})`);
    }

    if (filters) {
      const validFilters = filters.split(' and ').filter((filter) => {
        const filterColumn = filter.split(' ')[0];
        return selectedColumns.includes(filterColumn) || columns.some((col) => col.name === filterColumn);
      });

      validFilters.forEach((filter) => whereConditions.add(filter));
    }

    if (where && where.expressions && Array.isArray(where.expressions)) {
      where.expressions.forEach((condition) => {
        if ('expressions' in condition) {
          this.appendWhere(selectedColumns, filters, datetimeColumn, shouldApplyTimeFilter, columns, parts, {
            type: condition.type,
            expressions: condition.expressions,
          });
        } else if (
          condition.type === BuilderQueryEditorExpressionType.Operator &&
          condition.operator &&
          condition.property
        ) {
          const operatorName = condition.operator?.name;
          let operatorValue = String(condition.operator?.value).trim();
          const columnName = condition.property?.name;

          if (operatorName && operatorValue && columnName) {
            if (
              (operatorValue.startsWith("'") && operatorValue.endsWith("'")) ||
              (operatorValue.startsWith('"') && operatorValue.endsWith('"'))
            ) {
              operatorValue = operatorValue.slice(1, -1);
            }

            const newCondition = `${columnName} ${operatorName} '${operatorValue}'`;

            if (!whereConditions.has(newCondition)) {
              whereConditions.add(newCondition);
            }
          }
        }
      });
    }

    if (whereConditions.size > 0) {
      parts.push(`where ${Array.from(whereConditions).join(' and ')}`);
    }
  }

  private static appendSummarize(
    selectedColumns: string[],
    aggregation: string | undefined,
    groupBy: string[] | undefined,
    datetimeColumn: string,
    parts: string[]
  ) {
    const hasValidAggregation = !!(aggregation && aggregation.trim());
    const summarizeAlreadyAdded = parts.some((part) => part.startsWith('summarize'));
    const groupByParts = new Set<string>();

    if (groupBy && groupBy.length > 0) {
      if (hasValidAggregation) {
        groupBy.forEach((col) => groupByParts.add(col));

        if (aggregation.startsWith('percentile')) {
          const percentileValue = selectedColumns.includes('percentileParam') ? 15 : undefined;
          const column = selectedColumns.includes('percentileColumn');
          parts.push(`summarize ${aggregation}(${percentileValue}, ${column})`);
        } else {
          if (!summarizeAlreadyAdded) {
            parts.push(`summarize ${aggregation} by ${Array.from(groupByParts).join(', ')}`);
          }
        }
      } else if (!hasValidAggregation) {
        groupBy.forEach((col) => groupByParts.add(col));

        if (!summarizeAlreadyAdded) {
          parts.push(`summarize by ${Array.from(groupByParts).join(', ')}`);
        }
      }
    } else if (hasValidAggregation && !summarizeAlreadyAdded) {
      parts.push(`summarize ${aggregation}`);
    }
  }

  private static appendProject(selectedColumns: string[], parts: string[]) {
    if (selectedColumns.length > 0) {
      if (selectedColumns.includes('TimeGenerated') && !parts.some((p) => p.includes('$__timeFilter(TimeGenerated)'))) {
        parts.splice(1, 0, `where $__timeFilter(TimeGenerated)`);
      }

      parts.push(`project ${selectedColumns.join(', ')}`);
    }
  }

  private static appendOrderBy(
    datetimeColumn: string,
    selectedColumns: string[],
    groupBy: string[] | undefined,
    parts: string[],
    aggregation?: string
  ) {
    const hasDatetimeGroupBy = groupBy?.some((col) => col === datetimeColumn);
    const isOnlyTableSelected = selectedColumns.length === 0 && (!groupBy || groupBy.length === 0);

    if (hasDatetimeGroupBy) {
      parts.push(`summarize ${selectedColumns})`);
    } else if (isOnlyTableSelected) {
      parts.push(`order by ${datetimeColumn} asc`);
    } else if (!groupBy?.length && selectedColumns.includes(datetimeColumn)) {
      parts.push(`order by ${datetimeColumn} asc`);
    }
  }

  private static appendLimit(limit: number | undefined, parts: string[]) {
    if (limit && limit > 0) {
      parts.push(`limit ${limit}`);
    }
  }
}
