import React, { useMemo, useState } from 'react';

import { SelectableValue } from '@grafana/data';
import { EditorRows } from '@grafana/plugin-ui';
import { Alert } from '@grafana/ui';

import {
  BuilderQueryExpression,
} from '../../dataquery.gen';
import { selectors } from '../../e2e/selectors';
import { AzureLogAnalyticsMetadataTable, AzureMonitorQuery, EngineSchema } from '../../types';

import { AggregateSection } from './AggregationSection';
import { FilterSection } from './FilterSection';
import { FuzzySearch } from './FuzzySearch';
import { GroupBySection } from './GroupBySection';
import KQLPreview from './KQLPreview';
import { LimitSection } from './LimitSection';
import { OrderBySection } from './OrderBySection';
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
        <OrderBySection {...props} allColumns={allColumns} query={query} onQueryUpdate={onQueryChange} />
        <FuzzySearch {...props} allColumns={allColumns} query={query} onQueryUpdate={onQueryChange} />
        <LimitSection {...props} allColumns={allColumns} query={query} onQueryUpdate={onQueryChange} />
        <KQLPreview
          query={query.azureLogAnalytics?.query || ''}
          hidden={isKQLPreviewHidden}
          setHidden={setIsKQLPreviewHidden}
        />
      </EditorRows>
    </span>
  );
};
