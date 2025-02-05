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
import { TableSection } from './TableSection';
import { formatKQLQuery } from './utils';

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

  const handleColumnChange = (columns: Array<SelectableValue<string>>) => {
    setSelectedColumns(columns);
    const uniqueLabels = [...new Set(columns.map((c: SelectableValue<string>) => c.label!))];
    const baseQuery = selectedTable!.split(' | project')[0];
    const newQueryString = `${baseQuery} | project ${uniqueLabels.join(', ')} | where $__timeFilter(TimeGenerated)`;

    const formattedQuery = formatKQLQuery(newQueryString);
    console.log(formattedQuery)

    onQueryChange({
      ...query,
      azureLogAnalytics: {
        ...query.azureLogAnalytics,
        query: columns.length > 0 ? formattedQuery : baseQuery,
      },
    });
  };

  const handleTableChange = (newTable: AzureLogAnalyticsMetadataTable) => {
    if (newTable) {
      setSelectedTable(newTable.name);
      setColumns([]);

      onQueryChange({
        ...query,
        azureLogAnalytics: {
          ...query.azureLogAnalytics,
          query: newTable.name,
        },
      });
    }
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
          onColumnChange={handleColumnChange}
          onTableChange={handleTableChange}
          selectedColumns={selectedColumns}
          table={selectedTable}
          tables={tables}
        />
        <FilterSection {...props} query={query} onChange={onQueryChange} selectedColumns={selectedColumns} />
        <AggregateSection {...props} selectedColumns={selectedColumns} onChange={onQueryChange} />
        <GroupBySection {...props} selectedColumns={selectedColumns} onChange={onQueryChange} />
        <KQLPreview query={query.azureLogAnalytics?.query || ''} />
      </EditorRows>
    </span>
  );
};
