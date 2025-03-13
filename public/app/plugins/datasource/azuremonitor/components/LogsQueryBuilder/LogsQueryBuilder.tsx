import React, { useMemo, useState } from 'react';

import { SelectableValue } from '@grafana/data';
import { EditorField, EditorFieldGroup, EditorRow, EditorRows } from '@grafana/plugin-ui';
import { Alert, Input } from '@grafana/ui';

import {
  BuilderQueryEditorExpressionType,
  BuilderQueryEditorPropertyType,
  BuilderQueryExpression,
} from '../../dataquery.gen';
import { selectors } from '../../e2e/selectors';
import { AzureLogAnalyticsMetadataTable, AzureMonitorQuery, EngineSchema } from '../../types';

import { AggregateSection } from './AggregationSection';
import { AzureMonitorKustoQueryParser } from './AzureMonitorKustoQueryParser';
import { FilterSection } from './FilterSection';
import { FuzzySearch } from './FuzzySearch';
import { GroupBySection } from './GroupBySection';
import KQLPreview from './KQLPreview';
import { TableSection } from './TableSection';
import { DEFAULT_LOGS_BUILDER_QUERY, parseQueryToBuilder } from './utils';

interface LogsQueryBuilderProps {
  query: AzureMonitorQuery;
  basicLogsEnabled: boolean;
  onQueryChange: (newQuery: AzureMonitorQuery) => void;
  schema: EngineSchema;
  templateVariableOptions: SelectableValue<string>;
}

export const LogsQueryBuilder: React.FC<LogsQueryBuilderProps> = (props) => {
  const { query, onQueryChange, schema } = props;
  const [isKQLPreviewHidden, setIsKQLPreviewHidden] = useState<boolean>(true);
  const [limit, setLimit] = useState<number>();

  const tables: AzureLogAnalyticsMetadataTable[] = useMemo(() => {
    return schema?.database?.tables || [];
  }, [schema?.database]);

  const builderQuery: BuilderQueryExpression = query.azureLogAnalytics?.query
    ? parseQueryToBuilder(query.azureLogAnalytics?.query)
    : DEFAULT_LOGS_BUILDER_QUERY;

  const updatedBuilderQuery = { ...builderQuery };

  const isBuilderQueryChanged =
    JSON.stringify(updatedBuilderQuery) !== JSON.stringify(query.azureLogAnalytics?.builderQuery);

  if (isBuilderQueryChanged) {
    onQueryChange({
      ...query,
      azureLogAnalytics: {
        ...query.azureLogAnalytics,
        builderQuery: updatedBuilderQuery,
      },
    });
  }

  const allColumns = useMemo(() => {
    if (!builderQuery.from?.property.name || !tables) {
      return [];
    }
    const selectedTable = tables.find((table) => table.name === builderQuery!.from?.property.name);
    return selectedTable?.columns || [];
  }, [builderQuery, tables]);

  const handleQueryLimitUpdate = (limit: number) => {
    const updatedBuilderQuery: BuilderQueryExpression = {
      ...query.azureLogAnalytics?.builderQuery,
      reduce: query.azureLogAnalytics?.builderQuery?.reduce,
      from: {
        property: {
          name: query.azureLogAnalytics?.builderQuery?.from?.property.name!,
          type: BuilderQueryEditorPropertyType.String,
        },
        type: BuilderQueryEditorExpressionType.Property,
      },
      limit: limit,
    };

    const updatedQueryString = AzureMonitorKustoQueryParser.toQuery(updatedBuilderQuery, allColumns);

    onQueryChange({
      ...query,
      azureLogAnalytics: {
        ...query.azureLogAnalytics,
        builderQuery: updatedBuilderQuery,
        query: updatedQueryString,
      },
    });
  };

  return (
    <span data-testid={selectors.components.queryEditor.logsQueryEditor.container.input}>
      <EditorRows>
        {schema && tables.length === 0 && (
          <Alert severity="warning" title="Resource loaded successfully but without any tables" />
        )}
        <TableSection {...props} tables={tables} allColumns={allColumns} query={query} onQueryUpdate={onQueryChange} />
        <FilterSection {...props} onQueryUpdate={onQueryChange} allColumns={allColumns} query={query} />
        <AggregateSection {...props} allColumns={allColumns} query={query} onQueryUpdate={onQueryChange} />
        <GroupBySection {...props} allColumns={allColumns} query={query} onQueryUpdate={onQueryChange} />
        <FuzzySearch {...props} allColumns={allColumns} query={query} onQueryUpdate={onQueryChange} />
        <EditorRow>
          <EditorFieldGroup>
            <EditorField label="Limit" optional={true}>
              <Input
                className="width-10"
                type="number"
                placeholder="Enter limit"
                value={limit ?? ''}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                  const newValue = e.target.value.replace(/[^0-9]/g, '');
                  setLimit(newValue ? Number(newValue) : undefined);
                  handleQueryLimitUpdate(Number(newValue));
                }}
              />
            </EditorField>
          </EditorFieldGroup>
        </EditorRow>
        <KQLPreview
          query={query.azureLogAnalytics?.query || ''}
          hidden={isKQLPreviewHidden}
          setHidden={setIsKQLPreviewHidden}
        />
      </EditorRows>
    </span>
  );
};
