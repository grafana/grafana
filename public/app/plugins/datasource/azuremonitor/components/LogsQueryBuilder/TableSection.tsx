import React, { useEffect, useState } from 'react';

import { SelectableValue } from '@grafana/data';
import { EditorField, EditorFieldGroup, EditorRow } from '@grafana/experimental';
import { Select } from '@grafana/ui';

import { AzureMonitorQuery } from '../../types';
import { setKustoQuery } from '../LogsQueryEditor/setQueryValue';

interface TableSectionProps {
  query: AzureMonitorQuery;
  tables: AzureLogsTableSchema[] | undefined;
  onChange: (newQuery: AzureMonitorQuery) => void;
  table?: SelectableValue<string>;
}

export interface AzureLogsTableSchema {
  id: string;
  name: string;
  columns: AzureLogsColumnSchema[];
}

export interface AzureLogsColumnSchema {
  name: string;
  type: string;
}

export const TableSection: React.FC<TableSectionProps> = (props) => {
  const { tables = [], query, onChange } = props;
  const [tableOptions, setTableOptions] = useState<Array<SelectableValue<string>>>([]);
  const [selectedTable, setSelectedTable] = useState<SelectableValue<string> | null>(null);
  const [columnOptions, setColumnOptions] = useState<Array<SelectableValue<string>>>([]);
  const [selectedColumn, setSelectedColumn] = useState<SelectableValue<string> | null>(null);
  const [queryString, setQueryString] = useState<string>('');

  const toColumnName = (column: AzureLogsColumnSchema) => column.name.split('[')[0];

  useEffect(() => {
    if (tables.length > 0) {
      const options: Array<SelectableValue<string>> = tables.map((table) => ({
        label: table.name,
        value: table.name,
        columns: table.columns,
      }));
      setTableOptions(options);
    }
  }, [tables]);

  const handleTableChange = (selected: SelectableValue<string>) => {
    setSelectedTable(selected);
    setSelectedColumn([]);

    const selectedTableDetails = tableOptions.find((t) => t.value === selected.value);
    if (selectedTableDetails && 'columns' in selectedTableDetails) {
      const newColumnOptions: AzureLogsColumnSchema[] = selectedTableDetails.columns.map(
        (col: AzureLogsColumnSchema) => ({
          label: toColumnName(col),
          value: col.name,
        })
      );
      setColumnOptions(newColumnOptions);
    } else {
      setColumnOptions([]);
    }

    setQueryString(selected.label!);
    onChange(setKustoQuery(query, selected.label!));
  };

  return (
    <EditorRow>
      <EditorFieldGroup>
        <EditorField label="Table">
          <Select
            aria-label="Table"
            value={selectedTable}
            options={tableOptions}
            placeholder="Select a table"
            onChange={handleTableChange}
          />
        </EditorField>
        <EditorField label="Columns">
          <Select
            aria-label="Columns"
            isMulti
            value={selectedColumn}
            options={columnOptions}
            placeholder="Select columns"
            onChange={(selected) => {
              setSelectedColumn(selected);
              if (selected.length > 0) {
                const uniqueLabels = [...new Set(selected.map((c: SelectableValue<string>) => c.label!))];
                const baseQuery = queryString.split(' | project')[0];
                const newQueryString = `${baseQuery} | project ${uniqueLabels.join(', ')}`;
                setQueryString(newQueryString);
                onChange(setKustoQuery(query, newQueryString));
              } else {
                const baseQuery = queryString.split(' | project')[0];
                setQueryString(baseQuery);
                onChange(setKustoQuery(query, baseQuery));
              }
            }}
            isDisabled={!selectedTable}
          />
        </EditorField>
      </EditorFieldGroup>
    </EditorRow>
  );
};
