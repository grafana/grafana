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
import { DEFAULT_LOGS_BUILDER_QUERY } from './utils';

interface TableSectionProps {
  allColumns: AzureLogAnalyticsMetadataColumn[];
  tables: AzureLogAnalyticsMetadataTable[];
  query: AzureMonitorQuery;
  onQueryUpdate: (newQuery: AzureMonitorQuery) => void;
}

export const TableSection: React.FC<TableSectionProps> = (props) => {
  const { allColumns, query, tables, onQueryUpdate } = props;
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

  const handleTableChange = (selected: SelectableValue<string>) => {
    const selectedTable = tables.find((t) => t.name === selected.value);
    if (selectedTable) {
      const updatedBuilderQuery: BuilderQueryExpression = {
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

    const updatedBuilderQuery: BuilderQueryExpression = {
      ...DEFAULT_LOGS_BUILDER_QUERY,
      ...builderQuery,
      columns: { columns: selectedArray, type: BuilderQueryEditorExpressionType.Property },
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
            value={selectedColumns}
            options={columnOptions}
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
