import React, { useEffect, useMemo, useState } from 'react';

import { SelectableValue } from '@grafana/data';
import { EditorField, EditorFieldGroup, EditorRow, EditorRows } from '@grafana/plugin-ui';
import { Alert, Input } from '@grafana/ui';

import { selectors } from '../../e2e/selectors';
import {
  AzureLogAnalyticsMetadataColumn,
  AzureLogAnalyticsMetadataTable,
  AzureMonitorQuery,
  EngineSchema,
} from '../../types';

import { AggregateSection } from './AggregationSection';
import { AzureMonitorKustoQueryParser } from './AzureMonitorKustoQueryParser';
import { FilterSection } from './FilterSection';
import { GroupBySection } from './GroupBySection';
import KQLPreview from './KQLPreview';
import { TableSection } from './TableSection';
import { parseQuery } from './utils';

interface LogsQueryBuilderProps {
  query: AzureMonitorQuery;
  basicLogsEnabled: boolean;
  onQueryChange: (newQuery: AzureMonitorQuery) => void;
  schema: EngineSchema;
}

export const LogsQueryBuilder: React.FC<LogsQueryBuilderProps> = (props) => {
  const { query, onQueryChange, schema } = props;

  const tables: AzureLogAnalyticsMetadataTable[] = useMemo(() => {
    return schema?.database?.tables || [];
  }, [schema?.database]);

  const [selectedTable, setSelectedTable] = useState<string | null>(null);
  const [columns, setColumns] = useState<AzureLogAnalyticsMetadataColumn[]>([]);
  const [selectedColumns, setSelectedColumns] = useState<Array<SelectableValue<string>>>([]);
  const [limit, setLimit] = useState<number>();

  useEffect(() => {
    if (selectedTable) {
      const tableDetails = tables.find((table) => table.name === selectedTable);
      setSelectedColumns([]);
      setColumns(tableDetails?.columns || []);
    }
  }, [selectedTable, tables]);

  const handleQueryUpdate = ({
    newTable,
    newColumns,
    filters,
    aggregates,
    groupBy,
    limit,
  }: {
    newTable?: AzureLogAnalyticsMetadataTable;
    newColumns?: Array<SelectableValue<string>>;
    filters?: string;
    aggregates?: string;
    groupBy?: string[];
    limit?: number;
  }) => {
    let tableName = selectedTable;
    let columnList = selectedColumns.map((c) => c.value!);
  
    const prevQuery = query.azureLogAnalytics?.query || '';
    const { prevFilters, prevAggregates, prevGroupBy } = parseQuery(prevQuery);
  
    const isNewTable = newTable && newTable.name !== selectedTable;
  
    // ✅ **Reset when switching tables**
    if (isNewTable) {
      tableName = newTable.name;
      setSelectedTable(newTable.name);
      setSelectedColumns([]); // ✅ Clear selected columns
  
      // ✅ **Ensure $__timeFilter is included**
      const timeFilter = `$__timeFilter(TimeGenerated)`;
  
      onQueryChange({
        ...query,
        azureLogAnalytics: {
          ...query.azureLogAnalytics,
          query: `${tableName}\n| where ${timeFilter}\n| order by TimeGenerated asc`,
        },
      });
  
      return;
    }
  
    if (newColumns) {
      setSelectedColumns(newColumns);
      columnList = [...new Set(newColumns.map((c) => c.label!))];
    }
  
    // ✅ **Preserve previous filters if not explicitly updated**
    let updatedFilters = filters !== undefined ? filters : prevFilters;
  
    // ✅ **Determine if the selected column is a datetime**
    const hasSelectedDatetime = columnList.some(
      (col) => columns.find((c) => c.name === col)?.type === 'datetime'
    );
  
    if (hasSelectedDatetime) {
      // ✅ **Ensure Time Filter Exists**
      if (!updatedFilters.includes(`$__timeFilter(TimeGenerated)`)) {
        updatedFilters = `$__timeFilter(TimeGenerated) and ${updatedFilters}`.trim();
      }
    } else {
      // ✅ **Remove Time Filter If No Datetime Columns Are Selected**
      updatedFilters = updatedFilters.replace(`$__timeFilter(TimeGenerated) and `, '').trim();
      updatedFilters = updatedFilters.replace(`$__timeFilter(TimeGenerated)`, '').trim();
    }
  
    // ✅ **Rebuild the query using the cleaned filters**
    const formattedQuery = AzureMonitorKustoQueryParser.updateQuery(
      tableName!,
      columnList,
      columns,
      updatedFilters,
      aggregates !== undefined ? aggregates : prevAggregates,
      groupBy !== undefined ? groupBy : prevGroupBy,
      limit
    );
  
    onQueryChange({
      ...query,
      azureLogAnalytics: {
        ...query.azureLogAnalytics,
        query: formattedQuery,
      },
    });
  };
  
  return (
    <span data-testid={selectors.components.queryEditor.logsQueryEditor.container.input}>
      <EditorRows>
        {schema && tables.length === 0 && (
          <Alert severity="warning" title="Resource loaded successfully but without any tables" />
        )}
        <TableSection
          {...props}
          columns={columns}
          onQueryUpdate={handleQueryUpdate}
          selectedColumns={selectedColumns}
          table={selectedTable}
          tables={tables}
        />
        <FilterSection {...props} onQueryUpdate={handleQueryUpdate} selectedTable={selectedTable!} columns={columns} selectedColumns={selectedColumns} />
        <AggregateSection {...props} selectedColumns={selectedColumns} onQueryUpdate={handleQueryUpdate} />
        <GroupBySection {...props} selectedColumns={selectedColumns} onQueryUpdate={handleQueryUpdate} />
        <EditorRow>
          <EditorFieldGroup>
            <EditorField label="Limit">
              <Input
                className="width-10"
                type="number"
                placeholder="Enter limit"
                value={limit ?? ''}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                  const newValue = e.target.value.replace(/[^0-9]/g, '');
                  setLimit(newValue ? Number(newValue) : undefined);
                  handleQueryUpdate({ limit: Number(newValue) });
                }}
              />
            </EditorField>
          </EditorFieldGroup>
        </EditorRow>
        <KQLPreview query={query.azureLogAnalytics?.query || ''} />
      </EditorRows>
    </span>
  );
};
