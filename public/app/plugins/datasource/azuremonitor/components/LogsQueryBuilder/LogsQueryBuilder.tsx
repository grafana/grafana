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
import { FilterSection } from './FilterSection';
import { GroupBySection } from './GroupBySection';
import KQLPreview from './KQLPreview';
import { AzureMonitorQueryParser } from './KustoExpressionQueryParser';
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
      if (tableDetails && tableDetails.columns) {
        setColumns(tableDetails.columns || []);
      } else {
        setColumns([]);
      }
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
          query: `${tableName}\n| where ${timeFilter}\n| order by TimeGenerated asc`, // ✅ Ensure time filter and ordering
        },
      });

      return; // ✅ Prevent further execution since everything is reset
    }

    if (newColumns) {
      setSelectedColumns(newColumns);
      columnList = [...new Set(newColumns.map((c) => c.label!))];
    } else {
      columnList = selectedColumns.map((c) => c.value!);
    }

    // ✅ **Step 1: Identify Removed Columns**
    const removedColumns =
      prevQuery
        .match(/\| project (.+)/)?.[1]
        ?.split(', ')
        .filter((col) => !columnList.includes(col)) || [];

    // ✅ **Step 2: Ensure Filters Are Removed If Needed**
    const updatedFilters =
      isNewTable || removedColumns.length > 0
        ? `$__timeFilter(TimeGenerated)` // ✅ Ensure time filter is applied
        : filters !== undefined
          ? filters
          : prevFilters;

    // ✅ **Step 3: Ensure Aggregates Are Preserved Unless Reset**
    const updatedAggregates =
      isNewTable || removedColumns.length > 0
        ? '' // ✅ Clear aggregates if switching tables OR removing a referenced column
        : aggregates !== undefined
          ? aggregates
          : prevAggregates;

    // ✅ **Step 4: Ensure Group Bys Are Preserved Unless Reset**
    const updatedGroupBy =
      isNewTable || removedColumns.length > 0
        ? [] // ✅ Clear groupBys if switching tables OR removing a referenced column
        : groupBy !== undefined
          ? groupBy
          : prevGroupBy;

    // ✅ **Step 5: Call `updateQuery` with Cleaned Values**
    const formattedQuery = AzureMonitorQueryParser.updateQuery(
      tableName!,
      columnList,
      columns,
      updatedFilters,
      updatedAggregates,
      updatedGroupBy,
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
        <FilterSection {...props} onQueryUpdate={handleQueryUpdate} selectedColumns={selectedColumns} />
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
