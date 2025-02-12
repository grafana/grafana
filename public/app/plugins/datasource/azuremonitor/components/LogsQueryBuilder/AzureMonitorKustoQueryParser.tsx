import { AzureLogAnalyticsMetadataColumn } from '../../types';

export class AzureMonitorKustoQueryParser {
  constructor() {}

  static toQuery(params: {
    selectedTable: string;
    selectedColumns: string[];
    columns: AzureLogAnalyticsMetadataColumn[];
    filters?: string;
    aggregation?: string;
    groupBy?: string[];
    limit?: number;
  }): string {
    const { selectedTable, selectedColumns, columns, filters, aggregation, groupBy, limit } = params;

    if (!selectedTable) {
      return '';
    }

    const parts: string[] = [];
    const datetimeColumn = this.getDatetimeColumn(columns);
    const shouldApplyTimeFilter = this.shouldApplyTimeFilter(selectedColumns, datetimeColumn);

    this.appendFrom(selectedTable, parts);
    this.appendWhere(selectedColumns, filters, datetimeColumn, shouldApplyTimeFilter, columns, parts);
    this.appendSummarize(selectedColumns, aggregation, groupBy, datetimeColumn, parts);
    this.appendOrderBy(datetimeColumn, selectedColumns, groupBy, shouldApplyTimeFilter, parts);
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
    const groupByParts = new Set<string>();
    if (groupBy) {
      groupBy.forEach((col) => groupByParts.add(col));
      if (selectedColumns.includes(datetimeColumn)) {
        groupByParts.add(`bin(${datetimeColumn}, 1m)`);
      }
    }

    const hasValidGroupBy = groupByParts.size > 0;
    const hasValidAggregation = !!(aggregation && aggregation.trim());

    if (hasValidAggregation || hasValidGroupBy) {
      parts.push(
        `summarize ${aggregation || 'count()'}${hasValidGroupBy ? ` by ${Array.from(groupByParts).join(', ')}` : ''}`
      );
    } else if (selectedColumns.length > 0) {
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
    if (
      shouldApplyTimeFilter &&
      !groupBy?.some((col) => col.startsWith('bin(')) &&
      !selectedColumns.includes(datetimeColumn)
    ) {
      parts.push(`order by ${datetimeColumn} asc`);
    }
  }

  private static appendLimit(limit: number | undefined, parts: string[]) {
    if (limit && limit > 0) {
      parts.push(`limit ${limit}`);
    }
  }
}
