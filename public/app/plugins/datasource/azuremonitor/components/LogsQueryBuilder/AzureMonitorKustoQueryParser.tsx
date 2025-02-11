import { AzureLogAnalyticsMetadataColumn } from "../../types";

export class AzureMonitorKustoQueryParser {
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
      return ''; 
    }

    let updatedQuery = selectedTable;
    let whereConditions = new Set<string>();

    // **Step 1: Detect first datetime column (Do NOT assume TimeGenerated)**
    const datetimeColumn = columns.find((col) => col.type === 'datetime')?.name || 'TimeGenerated';

    // **Step 2: Determine if time filter should be applied**
    const hasSelectedTimeColumn = selectedColumns.includes(datetimeColumn);
    const shouldApplyTimeFilter = selectedColumns.length === 0 || hasSelectedTimeColumn;

    // **Step 3: Ensure $__timeFilter is added ONLY when necessary**
    if (shouldApplyTimeFilter) {
      whereConditions.add(`$__timeFilter(${datetimeColumn})`);
    }

    // **Step 4: Ensure Filters Are Retained**
    if (filters && filters.trim()) {
      const validFilters = filters.split(' and ').filter((filter) => {
        const filterColumn = filter.split(' ')[0]; 
        return (
          selectedColumns.includes(filterColumn) || columns.some((col) => col.name === filterColumn)
        ); 
      });

      if (validFilters.length > 0) {
        whereConditions.add(validFilters.join(' and '));
      }
    }

    // **Step 5: Ensure `where` is added BEFORE `project`**
    if (whereConditions.size > 0) {
      updatedQuery += `\n| where ${Array.from(whereConditions).join(' and ')}`;
    }

    // **Step 6: Handle Aggregation and Group By Correctly**
    let finalGroupBy = new Set(groupBy || []);

    if (finalGroupBy.size > 0) {
      if (hasSelectedTimeColumn) {
        finalGroupBy.add(`bin(${datetimeColumn}, 1m)`);
      }
    }

    if (aggregation?.trim()) {
      updatedQuery += `\n| summarize ${aggregation}${
        finalGroupBy.size > 0 ? ` by ${Array.from(finalGroupBy).join(', ')}` : ''
      }`;
    }
    else if (finalGroupBy.size > 0) {
      updatedQuery += `\n| summarize count() by ${Array.from(finalGroupBy).join(', ')}`;
    }
    else if (selectedColumns.length > 0) {
      updatedQuery += `\n| project ${selectedColumns.join(', ')}`;
    }

    // **Step 7: Ensure `order by` is only added when needed**
    if (shouldApplyTimeFilter) {
      updatedQuery += `\n| order by ${datetimeColumn} asc`;
    }

    // **Step 8: Add limit if provided**
    if (limit && limit > 0) {
      updatedQuery += `\n| limit ${limit}`;
    }

    return updatedQuery;
  }
}
