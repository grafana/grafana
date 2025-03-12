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

    this.appendFrom(selectedTable, parts);
    this.appendWhere(selectedColumns, filters, datetimeColumn, shouldApplyTimeFilter, allColumns, parts, where);
    const groupByStrings = groupBy?.expressions?.map((expression) => expression.property.name) || [];
    this.appendSummarize(selectedColumns, aggregation, groupByStrings, datetimeColumn, parts);
    this.appendProject(selectedColumns, parts);
    this.appendOrderBy(datetimeColumn, selectedColumns, groupByStrings, parts);
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

    if (shouldApplyTimeFilter) {
      whereConditions.add(`$__timeFilter(${datetimeColumn})`);
    }

    if (filters) {
      const validFilters = filters.split(' and ').filter((filter) => {
        const filterColumn = filter.split(' ')[0];
        return selectedColumns.includes(filterColumn) || columns.some((col) => col.name === filterColumn);
      });

      if (validFilters.length > 0) {
        whereConditions.add(validFilters.join(' and '));
      }
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
          const operatorValue = condition.operator?.value;
          const columnName = condition.property?.name;

          if (operatorName && operatorValue && columnName) {
            if (operatorName === 'has' && columnName === '*') {
              const operatorValueStr = String(operatorValue);
              const conditionsArray = Array.from(whereConditions);

              conditionsArray.forEach((existingCondition: string) => {
                if (existingCondition.includes(operatorValueStr)) {
                  whereConditions.delete(existingCondition);
                }
              });

              whereConditions.add(`${columnName} has '${operatorValueStr}'`);
            } else {
              whereConditions.add(`${columnName} ${operatorName} '${operatorValue}'`);
            }
          }
        } else if (condition?.property?.name === '$__timeFilter(TimeGenerated)') {
          if (!Array.from(whereConditions).some((condition) => condition.includes('$__timeFilter(TimeGenerated)'))) {
            whereConditions.add(`$__timeFilter(TimeGenerated)`);
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
    const hasTimeFilter = parts.find((p) => p.includes('$__timeFilter'));

    if (hasValidAggregation && groupBy && groupBy.length > 0) {
      const groupByParts = new Set<string>();

      groupBy.forEach((col) => groupByParts.add(col));

      if (hasTimeFilter && datetimeColumn) {
        groupByParts.add(`bin(${datetimeColumn}, 1h)`);
      }

      if (aggregation.startsWith('percentile')) {
        const percentileValue = selectedColumns.includes('percentileParam') ? 15 : undefined;
        const column = selectedColumns.includes('percentileColumn') ? 'TenantId' : '';
        parts.push(`summarize ${aggregation}(${percentileValue}, ${column})`);
      } else {
        if (groupByParts.has(datetimeColumn)) {
          groupByParts.delete(datetimeColumn);
        }

        if (groupByParts.size > 0 && !summarizeAlreadyAdded) {
          parts.push(`summarize ${aggregation} by ${Array.from(groupByParts).join(', ')}`);
        }
      }
    } else if (!hasValidAggregation && groupBy && groupBy.length > 0) {
      const groupByParts = new Set<string>();

      groupBy.forEach((col) => groupByParts.add(col));

      if (selectedColumns.includes(datetimeColumn)) {
        groupByParts.add(`bin(${datetimeColumn}, 1h)`);
      }

      if (groupByParts.size > 0 && !summarizeAlreadyAdded) {
        parts.push(`summarize by ${Array.from(groupByParts).join(', ')}`);
      }
    } else if (hasValidAggregation && !summarizeAlreadyAdded) {
      if (aggregation === 'percentile') {
        parts.push(`summarize ${aggregation}(15, TenantId)`);
      } else {
        parts.push(`summarize ${aggregation}`);
      }
    }
  }

  private static appendProject(selectedColumns: string[], parts: string[]) {
    if (selectedColumns.length > 0) {
      parts.push(`project ${selectedColumns.join(', ')}`);
    }
  }

  private static appendOrderBy(
    datetimeColumn: string,
    selectedColumns: string[],
    groupBy: string[] | undefined,
    parts: string[]
  ) {
    const hasDatetimeGroupBy = groupBy?.some((col) => col === datetimeColumn);

    const hasBinApplied = parts?.some((col) => col.includes('bin('));

    if (hasDatetimeGroupBy && !hasBinApplied) {
      parts.push(`summarize ${selectedColumns.join(', ')} by bin(${datetimeColumn}, 1h)`);
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
