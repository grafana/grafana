import React from 'react';

import { SelectableValue } from '@grafana/data';
import { EditorField, EditorFieldGroup, EditorRow } from '@grafana/plugin-ui';
import { Select } from '@grafana/ui';

import {
  BuilderQueryExpression,
  BuilderQueryEditorPropertyType,
  BuilderQueryEditorExpressionType,
} from '../../dataquery.gen';
import { AzureMonitorQuery, AzureLogAnalyticsMetadataColumn, AzureLogAnalyticsMetadataTable } from '../../types';

import { AzureMonitorKustoQueryParser } from './AzureMonitorKustoQueryParser';
import { DEFAULT_LOGS_BUILDER_QUERY, getAggregations, getFilters } from './utils';

interface TableSectionProps {
  allColumns: AzureLogAnalyticsMetadataColumn[];
  tables: AzureLogAnalyticsMetadataTable[];
  query: AzureMonitorQuery;
  onQueryUpdate: (newQuery: AzureMonitorQuery) => void;
  templateVariableOptions?: SelectableValue<string>;
}

export const TableSection: React.FC<TableSectionProps> = (props) => {
  const { allColumns, query, tables, onQueryUpdate, templateVariableOptions } = props;
  const builderQuery = query.azureLogAnalytics?.builderQuery;
  const selectedColumns = query.azureLogAnalytics?.builderQuery?.columns?.columns;

  const tableOptions: Array<SelectableValue<string>> = tables.map((t) => ({
    label: t.name,
    value: t.name,
  }));

  const columnOptions: Array<SelectableValue<string>> = allColumns.map((col) => ({
    label: col.name,
    value: col.name,
    type: col.type,
  }));

  const selectableOptions: Array<SelectableValue<string>> = [
    ...columnOptions,
    ...(templateVariableOptions
      ? Array.isArray(templateVariableOptions)
        ? templateVariableOptions
        : [templateVariableOptions]
      : []),
  ];

  const handleTableChange = (selected: SelectableValue<string>) => {
    const selectedTable = tables.find((t) => t.name === selected.value);
    if (selectedTable) {
      const updatedBuilderQuery: BuilderQueryExpression = {
        ...DEFAULT_LOGS_BUILDER_QUERY,
        from: {
          property: { name: selectedTable.name, type: BuilderQueryEditorPropertyType.String },
          type: BuilderQueryEditorExpressionType.Property,
        },
      };

      const updatedQueryString = AzureMonitorKustoQueryParser.toQuery(updatedBuilderQuery, allColumns);
      onQueryUpdate({
        ...query,
        azureLogAnalytics: {
          ...query.azureLogAnalytics,
          builderQuery: updatedBuilderQuery,
          query: updatedQueryString,
        },
      });
    }
  };

  const handleColumnsChange = (selected: SelectableValue<string> | Array<SelectableValue<string>>) => {
    const selectedArray = Array.isArray(selected) ? selected.map((col) => col.value!) : [selected.value!];

    const updatedColumns = selectedArray.map((col) => ({
      name: col,
      type: col.startsWith('$')
        ? BuilderQueryEditorPropertyType.String
        : allColumns.find((c) => c.name === col)?.type || BuilderQueryEditorPropertyType.String,
    }));

    const updatedBuilderQuery: BuilderQueryExpression = {
      ...builderQuery,
      columns: { columns: updatedColumns.map((col) => col.name), type: BuilderQueryEditorExpressionType.Property },
    };

    const aggregation = getAggregations(updatedBuilderQuery.reduce?.expressions);
    const filters = getFilters(updatedBuilderQuery.where?.expressions);
    const updatedQueryString = AzureMonitorKustoQueryParser.toQuery(
      updatedBuilderQuery,
      allColumns,
      aggregation,
      filters
    );

    onQueryUpdate({
      ...query,
      azureLogAnalytics: {
        ...query.azureLogAnalytics,
        builderQuery: updatedBuilderQuery,
        query: updatedQueryString,
      },
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
          />
        </EditorField>
        <EditorField label="Columns">
          <Select
            aria-label="Columns"
            isMulti
            value={selectedColumns?.map((col) => ({ label: col, value: col })) || []}
            options={selectableOptions}
            placeholder="Select columns"
            onChange={(e) => {
              handleColumnsChange(e);
            }}
            isDisabled={!query.azureLogAnalytics?.builderQuery?.from?.property.name}
          />
        </EditorField>
      </EditorFieldGroup>
    </EditorRow>
  );
};
