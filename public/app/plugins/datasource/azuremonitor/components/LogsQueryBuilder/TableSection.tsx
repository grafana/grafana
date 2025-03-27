import React from 'react';

import { SelectableValue } from '@grafana/data';
import { EditorField, EditorFieldGroup, EditorRow, InputGroup } from '@grafana/plugin-ui';
import { Button, Select } from '@grafana/ui';

import { BuilderQueryEditorExpressionType, BuilderQueryEditorPropertyType } from '../../dataquery.gen';
import { AzureMonitorQuery, AzureLogAnalyticsMetadataColumn, AzureLogAnalyticsMetadataTable } from '../../types';

import { BuildAndUpdateOptions, inputFieldSize } from './utils';

interface TableSectionProps {
  allColumns: AzureLogAnalyticsMetadataColumn[];
  tables: AzureLogAnalyticsMetadataTable[];
  query: AzureMonitorQuery;
  buildAndUpdateQuery: (options: Partial<BuildAndUpdateOptions>) => void;
  templateVariableOptions?: SelectableValue<string>;
}

export const TableSection: React.FC<TableSectionProps> = (props) => {
  const { allColumns, query, tables, buildAndUpdateQuery, templateVariableOptions } = props;
  const builderQuery = query.azureLogAnalytics?.builderQuery;
  const selectedColumns = query.azureLogAnalytics?.builderQuery?.columns?.columns || [];

  const tableOptions: Array<SelectableValue<string>> = tables.map((t) => ({
    label: t.name,
    value: t.name,
  }));

  const columnOptions: Array<SelectableValue<string>> = allColumns.map((col) => ({
    label: col.name,
    value: col.name,
    type: col.type,
  }));

  const selectAllOption: SelectableValue<string> = {
    label: 'Select All Columns',
    value: '__all_columns__',
  };

  const selectableOptions: Array<SelectableValue<string>> = [
    selectAllOption,
    ...columnOptions,
    ...(templateVariableOptions
      ? Array.isArray(templateVariableOptions)
        ? templateVariableOptions
        : [templateVariableOptions]
      : []),
  ];

  const handleTableChange = (selected: SelectableValue<string>) => {
    const selectedTable = tables.find((t) => t.name === selected.value);
    if (!selectedTable) {
      return;
    }

    buildAndUpdateQuery({
      from: {
        property: {
          name: selectedTable.name,
          type: BuilderQueryEditorPropertyType.String,
        },
        type: BuilderQueryEditorExpressionType.Property,
      },
    });
  };

  const handleColumnsChange = (selected: SelectableValue<string> | Array<SelectableValue<string>>) => {
    let selectedArray = Array.isArray(selected) ? selected.map((col) => col.value!) : [selected.value!];

    if (selectedArray.includes('__all_columns__')) {
      selectedArray = allColumns.map((col) => col.name);
    }

    buildAndUpdateQuery({
      columns: selectedArray,
    });
  };

  const onDeleteAllColumns = () => {
    buildAndUpdateQuery({
      columns: [],
    });
  };

  return (
    <EditorRow>
      <EditorFieldGroup>
        <EditorField label="Table">
          <Select
            aria-label="Table"
            value={builderQuery?.from?.property.name}
            options={tableOptions}
            placeholder="Select a table"
            onChange={handleTableChange}
            width={inputFieldSize}
          />
        </EditorField>
        <EditorField label="Columns">
          <InputGroup>
            <Select
              aria-label="Columns"
              isMulti
              value={selectedColumns.map((col) => ({ label: col, value: col })) || []}
              options={selectableOptions}
              placeholder="Select columns"
              onChange={(e) => {
                handleColumnsChange(e);
              }}
              isDisabled={!query.azureLogAnalytics?.builderQuery?.from?.property.name}
              width={inputFieldSize}
            />
            <Button variant="secondary" icon="times" onClick={onDeleteAllColumns} />
          </InputGroup>
        </EditorField>
      </EditorFieldGroup>
    </EditorRow>
  );
};
