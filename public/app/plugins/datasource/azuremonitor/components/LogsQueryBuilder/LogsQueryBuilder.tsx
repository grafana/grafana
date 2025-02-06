import React, { useEffect, useMemo, useState } from 'react';

import { SelectableValue } from '@grafana/data';
import { EditorRows } from '@grafana/plugin-ui';
import { Alert } from '@grafana/ui';

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
  }: {
    newTable?: AzureLogAnalyticsMetadataTable;
    newColumns?: Array<SelectableValue<string>>;
    filters?: string;
    aggregates?: string;
    groupBy?: string[];
  }) => {
    let tableName = selectedTable;
    let columnList = selectedColumns.map((c) => c.value!);

    if (newTable) {
      tableName = newTable.name;
      setSelectedTable(newTable.name);
      setColumns([]);
    }

    if (newColumns) {
      setSelectedColumns(newColumns);
      columnList = [...new Set(newColumns.map((c) => c.label!))];
    }

    const formattedQuery = AzureMonitorQueryParser.updateQuery(
      query.azureLogAnalytics?.query || '',
      tableName!,
      columnList,
      filters ?? '',
      aggregates ?? '',
      groupBy ?? []
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
        <KQLPreview query={query.azureLogAnalytics?.query || ''} />
      </EditorRows>
    </span>
  );
};
