import { AzureLogAnalyticsMetadataColumn } from "../../types";

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

    // ✅ **Step 1: Detect first datetime column (Do NOT assume TimeGenerated)**
    const datetimeColumn = columns.find((col) => col.type === 'datetime')?.name || 'TimeGenerated';

    // ✅ **Step 2: Determine if time filter should be applied**
    const hasSelectedTimeColumn = selectedColumns.includes(datetimeColumn);
    const shouldApplyTimeFilter = selectedColumns.length === 0 || hasSelectedTimeColumn;

    console.log("hasSelectedTimeColumn", hasSelectedTimeColumn)
    console.log("shouldApplyTimeFilter", shouldApplyTimeFilter)


    // ✅ **Step 3: Ensure $__timeFilter is added ONLY when required**
    if (shouldApplyTimeFilter) {
      whereConditions.add(`$__timeFilter(${datetimeColumn})`);
    }

    if (filters && filters.trim()) {
      whereConditions.add(filters);
    }

    // ✅ **Step 4: Ensure `where` clause is only added when necessary**
    if (whereConditions.size > 0) {
      // **Only add `where` if there’s a datetime column OR non-time filters exist**
      const validConditions = Array.from(whereConditions).filter((cond) => cond !== `$__timeFilter(${datetimeColumn})` || shouldApplyTimeFilter);

      if (validConditions.length > 0) {
        updatedQuery += `\n| where ${validConditions.join(' and ')}`;
      }
    }

    // ✅ **Step 5: Handle Aggregation and Group By Correctly**
    let finalGroupBy = new Set(groupBy || []);

    if (aggregation && aggregation.trim()) {
      // **Only apply time binning when a datetime column is explicitly selected**
      if (hasSelectedTimeColumn) {
        finalGroupBy.add(`bin(${datetimeColumn}, 1m)`);
      }

      updatedQuery += `\n| summarize ${aggregation}${
        finalGroupBy.size > 0 ? ` by ${Array.from(finalGroupBy).join(', ')}` : ''
      }`;
    }
    // ✅ **Apply Group By without aggregation**
    else if (finalGroupBy.size > 0) {
      updatedQuery += `\n| summarize count() by ${Array.from(finalGroupBy).join(', ')}`;
    }
    // ✅ **Ensure selected columns are projected when no aggregation or group by exists**
    else if (selectedColumns.length > 0) {
      updatedQuery += `\n| project ${selectedColumns.join(', ')}`;
    }

    // ✅ **Step 6: Ensure `order by` is only added when needed**
    if (shouldApplyTimeFilter) {
      updatedQuery += `\n| order by ${datetimeColumn} asc`;
    }

    // ✅ **Step 7: Add limit if provided**
    if (limit && limit > 0) {
      updatedQuery += `\n| limit ${limit}`;
    }

    return updatedQuery;
  }
}
