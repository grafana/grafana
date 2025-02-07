import { AzureLogAnalyticsMetadataColumn } from '../../types';

export class AzureMonitorQueryParser {
  static updateQuery(
    selectedTable: string,
    selectedColumns: string[],
    columns: AzureLogAnalyticsMetadataColumn[],
    filters?: string,
    aggregation?: string,
    groupBy?: string[]
  ): string {
    let updatedQuery = selectedTable;
    let whereConditions = new Set<string>();

    // **Step 1: Detect datetime column**
    const timeField = this.getTimeField(selectedColumns, columns);

    // **Step 2: Deduplicate Filters**
    if (timeField) {
      if (![...whereConditions].some((c) => c.includes(`$__timeFilter(${timeField})`))) {
        whereConditions.add(`$__timeFilter(${timeField})`);
      }
    }

    if (filters && filters.trim()) {
      whereConditions.add(filters);
    }

    if (whereConditions.size > 0) {
      updatedQuery += `\n| where ${Array.from(whereConditions).join(' and ')}`;
    }

    // **Step 3: Ensure Aggregation is Applied Independently**
    let finalGroupBy = new Set(groupBy || []);

    if (aggregation && aggregation.trim()) {
      if (timeField) {
        finalGroupBy.add(`bin(${timeField}, 1m)`);
      }

      updatedQuery += `\n| summarize ${aggregation}${
        finalGroupBy.size > 0 ? ` by ${Array.from(finalGroupBy).join(', ')}` : ''
      }`;
    } else if (selectedColumns.length > 0) {
      updatedQuery += `\n| project ${selectedColumns.join(', ')}`;
    }

    // **Step 4: Ensure Correct Execution Order**
    if (timeField) {
      updatedQuery += `\n| order by ${timeField} asc`;
    }

    return updatedQuery;
  }

  static getTimeField(selectedColumns: string[], columns: AzureLogAnalyticsMetadataColumn[]): string | null {
    const defaultTimeField = 'TimeGenerated';
    const datetimeColumn = columns.find((col) => selectedColumns.includes(col.name) && col.type === 'datetime');
    return datetimeColumn ? datetimeColumn.name : selectedColumns.length === 0 ? defaultTimeField : null;
  }
}
