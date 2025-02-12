import React, { useMemo} from 'react';

import { EditorRows } from '@grafana/plugin-ui';
import { Alert } from '@grafana/ui';

import { BuilderQueryExpression } from '../../dataquery.gen';
import { selectors } from '../../e2e/selectors';
import {
  AzureLogAnalyticsMetadataTable,
  AzureMonitorQuery,
  EngineSchema,
} from '../../types';

import KQLPreview from './KQLPreview';
import { TableSection } from './TableSection';
import { DEFAULT_LOGS_BUILDER_QUERY, parseQueryToExpression } from './utils';

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

  const parsedQuery: BuilderQueryExpression = query.azureLogAnalytics?.builderQuery
    ? parseQueryToExpression(query.azureLogAnalytics.query!)
    : DEFAULT_LOGS_BUILDER_QUERY;

  const allColumns = useMemo(() => {
    if (!parsedQuery.from?.property.name || !tables) {
      return [];
    }
    const selectedTable = tables.find((table) => table.name === parsedQuery!.from?.property.name);
    return selectedTable?.columns || [];
  }, [parsedQuery, tables]);

  return (
    <span data-testid={selectors.components.queryEditor.logsQueryEditor.container.input}>
      <EditorRows>
        {schema && tables.length === 0 && (
          <Alert severity="warning" title="Resource loaded successfully but without any tables" />
        )}
        <TableSection {...props} tables={tables} allColumns={allColumns} query={query} onQueryUpdate={onQueryChange} />
        {/* <FilterSection 
          {...props} 
          onQueryUpdate={onQueryChange} 
          selectedTable={selectedTable!} 
          columns={columns} 
          selectedColumns={selectedColumns} 
        />
        <AggregateSection 
          {...props} 
          selectedTable={selectedTable!} 
          columns={columns} 
          selectedColumns={selectedColumns} 
          onQueryUpdate={onQueryChange} 
        />
        <GroupBySection 
          {...props} 
          columns={columns} 
          selectedTable={selectedTable!} 
          selectedColumns={selectedColumns} 
          onQueryUpdate={onQueryChange} 
        />
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
        </EditorRow> */}
        <KQLPreview query={query.azureLogAnalytics?.query || ''} />
      </EditorRows>
    </span>
  );
};
