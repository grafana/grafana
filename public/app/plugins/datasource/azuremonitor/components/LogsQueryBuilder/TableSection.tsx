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
    label: 'All Columns',
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
      reduce: [],
      where: [],
      fuzzySearch: [],
      groupBy: [],
      orderBy: [],
      columns: [],
    });
  };

  const handleColumnsChange = (selected: SelectableValue<string> | Array<SelectableValue<string>> | null) => {
    const selectedArray = Array.isArray(selected) ? selected : selected ? [selected] : [];

    if (selectedArray.length === 0) {
      buildAndUpdateQuery({ columns: [] });
      return;
    }

    const includesAll = selectedArray.some((opt) => opt.value === '__all_columns__');
    const lastSelected = selectedArray[selectedArray.length - 1];

    if (includesAll && lastSelected.value === '__all_columns__') {
      buildAndUpdateQuery({
        columns: allColumns.map((col) => col.name),
      });
      return;
    }

    if (includesAll && selectedArray.length > 1) {
      const filtered = selectedArray.filter((opt) => opt.value !== '__all_columns__');
      buildAndUpdateQuery({
        columns: filtered.map((opt) => opt.value!),
      });
      return;
    }

    if (includesAll && selectedArray.length === 1) {
      buildAndUpdateQuery({
        columns: allColumns.map((col) => col.name),
      });
      return;
    }

    buildAndUpdateQuery({
      columns: selectedArray.map((opt) => opt.value!),
    });
  };

  const onDeleteAllColumns = () => {
    buildAndUpdateQuery({
      columns: [],
    });
  };

  const allColumnNames = allColumns.length > 0 ? allColumns.map((col) => col.name) : [];

  const areAllColumnsSelected =
    allColumnNames.length > 0 &&
    selectedColumns.length > 0 &&
    selectedColumns.length === allColumnNames.length &&
    allColumnNames.every((col) => selectedColumns.includes(col));

  const columnSelectValue: Array<SelectableValue<string>> = areAllColumnsSelected
    ? [selectAllOption]
    : selectedColumns.map((col) => ({ label: col, value: col }));

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
              isClearable
              closeMenuOnSelect={false}
              value={columnSelectValue}
              options={selectableOptions}
              placeholder="Select columns"
              onChange={handleColumnsChange}
              isDisabled={!builderQuery?.from?.property.name}
              width={30}
            />
            <Button variant="secondary" icon="times" onClick={onDeleteAllColumns} />
          </InputGroup>
        </EditorField>
      </EditorFieldGroup>
    </EditorRow>
  );
};
