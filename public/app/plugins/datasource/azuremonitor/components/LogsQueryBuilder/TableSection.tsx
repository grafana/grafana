import React from 'react';

import { SelectableValue } from '@grafana/data';
import { EditorField, EditorFieldGroup, EditorRow } from '@grafana/plugin-ui';
import { Select } from '@grafana/ui';

import { AzureLogAnalyticsMetadataColumn, AzureLogAnalyticsMetadataTable, QueryEditorPropertyType } from '../../types';

interface TableSectionProps {
  columns: AzureLogAnalyticsMetadataColumn[];
  onQueryUpdate: (params: {
    newTable?: AzureLogAnalyticsMetadataTable;
    newColumns?: Array<SelectableValue<string>>;
  }) => void;
  selectedColumns: SelectableValue<string>;
  table?: string | null;
  tables: AzureLogAnalyticsMetadataTable[];
}

export const TableSection: React.FC<TableSectionProps> = (props) => {
  const { columns, onQueryUpdate, selectedColumns, table, tables } = props;
  const tableOptions: Array<SelectableValue<string>> = tables.map((t) => ({
    label: t.name,
    value: t.name,
  }));

  const columnOptions: Array<SelectableValue<string>> = Array.isArray(columns)
    ? columns.map((col) => ({
        label: col.name,
        value: col.name,
        type: col.type || QueryEditorPropertyType.String,
      }))
    : [];

  return (
    <EditorRow>
      <EditorFieldGroup>
        <EditorField label="Table">
          <Select
            aria-label="Table"
            value={table}
            options={tableOptions}
            placeholder="Select a table"
            onChange={(selected) => {
              const selectedTable = tables.find((t) => t.name === selected.value);
              if (selectedTable) {
                onQueryUpdate({ newTable: selectedTable });
              }
            }}
          />
        </EditorField>
        <EditorField label="Columns">
          <Select
            aria-label="Columns"
            isMulti
            value={selectedColumns}
            options={columnOptions}
            placeholder="Select columns"
            onChange={(selected: SelectableValue<string> | Array<SelectableValue<string>>) => {
              const selectedArray = Array.isArray(selected) ? selected : [selected];
              onQueryUpdate({ newColumns: selectedArray });
            }}
            isDisabled={!table}
          />
        </EditorField>
      </EditorFieldGroup>
    </EditorRow>
  );
};
