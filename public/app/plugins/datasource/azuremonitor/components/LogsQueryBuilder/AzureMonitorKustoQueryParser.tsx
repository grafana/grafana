import { BuilderQueryExpression } from '../../dataquery.gen';
import { AzureLogAnalyticsMetadataColumn } from '../../types';

export class AzureMonitorKustoQueryParser {
  constructor() {}

  static toQuery(
    builderQuery: BuilderQueryExpression,
    allColumns: AzureLogAnalyticsMetadataColumn[],
    aggregation?: string,
    filters?: string
  ): string {
    const { from, columns, groupBy, limit } = builderQuery;

    if (!from || !from.property.name) {
      return ''; // If no table is specified, return an empty string.
    }

    const selectedTable = from.property.name;
    const selectedColumns = columns?.columns || [];
    const parts: string[] = [];
    const datetimeColumn = this.getDatetimeColumn(allColumns);
    const shouldApplyTimeFilter = this.shouldApplyTimeFilter(selectedColumns, datetimeColumn);

    // Append the table source
    this.appendFrom(selectedTable, parts);

    // Append where conditions
    this.appendWhere(selectedColumns, filters, datetimeColumn, shouldApplyTimeFilter, allColumns, parts);

    // Extract groupBy expressions if available
    const groupByStrings = groupBy?.expressions?.map((expression) => expression.property.name) || [];

    // Append aggregation (if applicable)
    this.appendSummarize(selectedColumns, aggregation, groupByStrings, datetimeColumn, parts);

    // Append selected columns if any
    this.appendProject(selectedColumns, parts);

    // Append order by if necessary
    this.appendOrderBy(datetimeColumn, selectedColumns, groupByStrings, shouldApplyTimeFilter, parts);

    // Append limit if applicable
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
    parts: string[]
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

      // Special handling for percentile aggregation
      if (aggregation.startsWith('percentile')) {
        const percentileValue = selectedColumns.includes('percentileParam') ? 15 : undefined; // Get the percentile value
        const column = selectedColumns.includes('percentileColumn') ? 'TenantId' : ''; // Get the column (e.g., 'TenantId')
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
      // Handle percentiles or other aggregations
      if (aggregation === 'percentile') {
        parts.push(`summarize ${aggregation}(15, TenantId)`); // Adjust with actual percentile and column
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
    shouldApplyTimeFilter: boolean,
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
