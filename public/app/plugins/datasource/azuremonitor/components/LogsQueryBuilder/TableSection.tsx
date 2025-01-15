import React, { useEffect, useState } from "react";

import { SelectableValue } from "@grafana/data";
import { EditorField, EditorFieldGroup, EditorRow } from "@grafana/experimental";
import { Select } from "@grafana/ui";

import { AzureMonitorQuery } from "../../types";

interface TableSectionProps {
  query: AzureMonitorQuery;
  tables: AzureLogsTableSchema[] | undefined;
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
  const { tables = [], query } = props;
  const [tableOptions, setTableOptions] = useState<Array<SelectableValue<string>>>([]);
  const [selectedTable, setSelectedTable] = useState<SelectableValue<string> | null>(null);
  const [columnOptions, setColumnOptions] = useState<Array<SelectableValue<string>>>([]);
  const [selectedColumn, setSelectedColumn] = useState<SelectableValue<string> | null>(null);

  const toColumnName = (column: AzureLogsColumnSchema) => column.name.split("[")[0];

  useEffect(() => {
    if (tables.length > 0) {
      const options = tables.map((table) => ({
        label: table.name,
        value: table.name,
        columns: table.columns,
      }));
      setTableOptions(options as Array<SelectableValue<string>>);
    }
  }, [tables]);

  const handleTableChange = (selected: SelectableValue<string>) => {
    setSelectedTable(selected);

    const selectedTableDetails = tableOptions.find((t) => t.value === selected.value);
    if (selectedTableDetails && "columns" in selectedTableDetails) {
      const newColumnOptions = (selectedTableDetails.columns as AzureLogsColumnSchema[]).map((col) => ({
        label: toColumnName(col),
        value: col.name,
      }));
      setColumnOptions(newColumnOptions);
    } else {
      setColumnOptions([]);
    }
  };

  return (
    <EditorRow>
      <EditorFieldGroup>
        <EditorField label="Table">
          <Select
            aria-label="Table"
            isLoading={tables.length === 0}
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
            }}
            isDisabled={!selectedTable}
          />
        </EditorField>
      </EditorFieldGroup>
    </EditorRow>
  );
};
