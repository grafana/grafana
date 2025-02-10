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

    // ✅ **Step 1: Detect first datetime column (Do NOT assume TimeGenerated)**
    const datetimeColumn = columns.find((col) => col.type === 'datetime')?.name || 'TimeGenerated';

    // ✅ **Step 2: Determine if time filter should be applied**
    const hasSelectedTimeColumn = selectedColumns.includes(datetimeColumn);
    const shouldApplyTimeFilter = selectedColumns.length === 0 || hasSelectedTimeColumn;

    // ✅ **Step 3: Ensure $__timeFilter is added ONLY ONCE**
    if (shouldApplyTimeFilter) {
      whereConditions.add(`$__timeFilter(${datetimeColumn})`);
    }

    // ✅ **Step 4: Remove Filters Referencing Removed Columns**
    if (filters && filters.trim()) {
      const validFilters = filters.split(' and ').filter((filter) => {
        const filterColumn = filter.split(' ')[0]; // Extract column name
        return selectedColumns.includes(filterColumn);
      });

      if (validFilters.length > 0) {
        whereConditions.add(validFilters.join(' and '));
      }
    }

    // ✅ **Step 5: Ensure `where` clause is only added when necessary**
    if (whereConditions.size > 0) {
      updatedQuery += `\n| where ${Array.from(whereConditions).join(' and ')}`;
    }

    // ✅ **Step 6: Handle Aggregation and Group By Correctly**
    let finalGroupBy = new Set(groupBy || []);

    if (aggregation && aggregation.trim()) {
      // 🚀 **Ensure only selected columns are aggregated**
      const validAggregation = aggregation
        .split(',')
        .filter((agg) => selectedColumns.some((col) => agg.includes(col)))
        .join(', ');

      if (validAggregation) {
        // ✅ **Ensure bin() is added only once**
        if (hasSelectedTimeColumn && ![...finalGroupBy].some((g) => g.startsWith('bin('))) {
          finalGroupBy.add(`bin(${datetimeColumn}, 1m)`);
        }

        updatedQuery += `\n| summarize ${validAggregation}${
          finalGroupBy.size > 0 ? ` by ${Array.from(finalGroupBy).join(', ')}` : ''
        }`;
      }
    }
    // ✅ **Apply Group By without aggregation**
    else if (finalGroupBy.size > 0) {
      // 🚀 **Ensure group-by columns exist in selected columns**
      const validGroupBy = [...finalGroupBy].filter((g) => selectedColumns.includes(g));

      if (validGroupBy.length > 0) {
        updatedQuery += `\n| summarize count() by ${validGroupBy.join(', ')}`;
      }
    }
    // ✅ **Ensure selected columns are projected when no aggregation or group by exists**
    else if (selectedColumns.length > 0) {
      updatedQuery += `\n| project ${selectedColumns.join(', ')}`;
    }

    // ✅ **Step 7: Ensure `order by` is only added when needed**
    if (shouldApplyTimeFilter) {
      updatedQuery += `\n| order by ${datetimeColumn} asc`;
    }

    // ✅ **Step 8: Add limit if provided**
    if (limit && limit > 0) {
      updatedQuery += `\n| limit ${limit}`;
    }

    return updatedQuery;
  }
}
