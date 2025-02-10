import { AzureLogAnalyticsMetadataColumn } from '../../types';

export class AzureMonitorQueryParser {
  static updateQuery(
    selectedTable: string,
    selectedColumns: string[],
    columns: AzureLogAnalyticsMetadataColumn[],
    filters?: string,
    aggregation?: string,
    groupBy?: string[],
    limit?: number
  ): string {
    if (!selectedTable) {
      return ''; // No table selected, return empty query
    }

    let updatedQuery = selectedTable;
    let whereConditions = new Set<string>();

    // **Step 1: Detect the first datetime column from selected columns**
    const datetimeColumn = columns.find(
      (col) => selectedColumns.includes(col.name) && col.type === 'datetime'
    );

    // **Step 2: If no columns are selected, assume TimeGenerated should be used**
    let timeField: string | null = datetimeColumn ? datetimeColumn.name : selectedColumns.length === 0 ? 'TimeGenerated' : null;

    // **Step 3: Add $__timeFilter() ONLY when a datetime column is involved OR no columns are selected**
    let timeFilterAdded = false;
    if (timeField) {
      whereConditions.add(`$__timeFilter(${timeField})`);
      timeFilterAdded = true;
    }

    if (filters && filters.trim()) {
      whereConditions.add(filters);
    }

    // **Step 4: Only add `where` clause if we actually have a time field or additional filters**
    if (whereConditions.size > 0 && (datetimeColumn || selectedColumns.length === 0)) {
      updatedQuery += `\n| where ${Array.from(whereConditions).join(' and ')}`;
    }

    // **Step 5: Handle Aggregation and Group By**
    let finalGroupBy = new Set(groupBy || []);
    if (aggregation && aggregation.trim()) {
      if (timeField) {
        finalGroupBy.add(`bin(${timeField}, 1m)`);
      }

      updatedQuery += `\n| summarize ${aggregation}${
        finalGroupBy.size > 0 ? ` by ${Array.from(finalGroupBy).join(', ')}` : ''
      }`;
    } else if (selectedColumns.length > 0) {
      const projectedColumns = new Set(selectedColumns);
      if (datetimeColumn) {
        projectedColumns.add(datetimeColumn.name); // Ensure datetime column is projected if selected
      }
      updatedQuery += `\n| project ${Array.from(projectedColumns).join(', ')}`;
    }

    // **Step 6: Add order by if timeField is present and it's not a non-datetime selection**
    if (timeFilterAdded) {
      updatedQuery += `\n| order by ${timeField} asc`;
    }

    // **Step 7: Add limit if provided**
    if (limit && limit > 0) {
      updatedQuery += `\n| limit ${limit}`;
    }

    return updatedQuery;
  }

  static getTimeField(selectedColumns: string[], columns: AzureLogAnalyticsMetadataColumn[]): string | null {
    const defaultTimeField = 'TimeGenerated';
    const datetimeColumn = columns.find((col) => selectedColumns.includes(col.name) && col.type === 'datetime');

    return datetimeColumn ? datetimeColumn.name : selectedColumns.length === 0 ? defaultTimeField : null;
  }
}
