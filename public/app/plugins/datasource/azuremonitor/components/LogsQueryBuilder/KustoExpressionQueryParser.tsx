export class AzureMonitorQueryParser {
  static updateQuery(
    query: string,
    selectedTable: string,
    selectedColumns: string[],
    filters?: string,
    aggregation?: string,
    groupBy?: string[]
  ): string {
    let updatedQuery = selectedTable;

    // **Step 1: Add Selected Columns (`| project`)**
    if (selectedColumns.length > 0) {
      updatedQuery += `\n| project ${selectedColumns.join(', ')}`;
    }

    // **Step 2: Add Time Filter (`| where $__timeFilter(TimeGenerated)`)**
    updatedQuery = AzureMonitorQueryParser.ensureTimeFilter(updatedQuery);

    // **Step 3: Add Additional Filters (`| where column operator value`)**
    if (filters && filters.trim()) {
      updatedQuery = AzureMonitorQueryParser.ensureWhereClause(updatedQuery, filters);
    }

    // **Step 4: Add Aggregation (`| summarize count() by column`)**
    if (aggregation && aggregation.trim()) {
      updatedQuery = AzureMonitorQueryParser.ensureSummarize(updatedQuery, aggregation, groupBy);
    }

    // **Step 5: Ensure Order By (`| order by TimeGenerated asc`)**
    updatedQuery = AzureMonitorQueryParser.ensureOrderBy(updatedQuery);

    return updatedQuery;
  }

  // ✅ Ensures that the time filter is always included
  static ensureTimeFilter(query: string): string {
    if (!query.includes('| where $__timeFilter(TimeGenerated)')) {
      return `${query}\n| where $__timeFilter(TimeGenerated)`;
    }
    return query;
  }

  // ✅ Ensures that additional filters are appended to the `| where` clause
  static ensureWhereClause(query: string, filters: string): string {
    if (query.includes('| where')) {
      return query.replace(/\| where.*/, `| where $__timeFilter(TimeGenerated) and ${filters}`);
    }
    return `${query}\n| where $__timeFilter(TimeGenerated) and ${filters}`;
  }

  // ✅ Ensures `| summarize` is correctly added without duplicates
  static ensureSummarize(query: string, aggregation: string, groupBy?: string[]): string {
    query = query.replace(/\| summarize.*/g, '').trim(); // Remove any existing summarize
    if (groupBy && groupBy.length > 0) {
      return `${query}\n| summarize ${aggregation} by ${groupBy.join(', ')}`;
    }
    return `${query}\n| summarize ${aggregation}`;
  }

  // ✅ Ensures the query ends with `| order by TimeGenerated asc`
  static ensureOrderBy(query: string): string {
    if (!query.includes('| order by TimeGenerated')) {
      return `${query}\n| order by TimeGenerated asc`;
    }
    return query;
  }
}
