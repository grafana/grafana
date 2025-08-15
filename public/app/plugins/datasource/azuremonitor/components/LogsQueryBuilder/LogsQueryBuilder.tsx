import React, { useMemo, useState, useCallback } from 'react';

import { SelectableValue, TimeRange } from '@grafana/data';
import { EditorRows } from '@grafana/plugin-ui';
import { Alert } from '@grafana/ui';

import {
  BuilderQueryEditorExpressionType,
  BuilderQueryEditorPropertyType,
  BuilderQueryEditorReduceExpression,
  BuilderQueryEditorWhereExpression,
  BuilderQueryEditorGroupByExpression,
  BuilderQueryEditorOrderByExpression,
  BuilderQueryEditorPropertyExpression,
  BuilderQueryExpression,
} from '../../dataquery.gen';
import Datasource from '../../datasource';
import { selectors } from '../../e2e/selectors';
import {
  AzureLogAnalyticsMetadataTable,
  AzureLogAnalyticsMetadataColumn,
  AzureMonitorQuery,
  EngineSchema,
} from '../../types';

import { AggregateSection } from './AggregationSection';
import { AzureMonitorKustoQueryBuilder } from './AzureMonitorKustoQueryBuilder';
import { FilterSection } from './FilterSection';
import { FuzzySearch } from './FuzzySearch';
import { GroupBySection } from './GroupBySection';
import KQLPreview from './KQLPreview';
import { LimitSection } from './LimitSection';
import { OrderBySection } from './OrderBySection';
import { TableSection } from './TableSection';
import { DEFAULT_LOGS_BUILDER_QUERY } from './utils';

interface LogsQueryBuilderProps {
  query: AzureMonitorQuery;
  basicLogsEnabled: boolean;
  onQueryChange: (newQuery: AzureMonitorQuery) => void;
  schema?: EngineSchema;
  templateVariableOptions: SelectableValue<string>;
  datasource: Datasource;
  timeRange?: TimeRange;
  isLoadingSchema: boolean;
}

export const LogsQueryBuilder: React.FC<LogsQueryBuilderProps> = (props) => {
  const { query, onQueryChange, schema, datasource, timeRange, isLoadingSchema } = props;
  const [isKQLPreviewHidden, setIsKQLPreviewHidden] = useState<boolean>(true);

  const tables: AzureLogAnalyticsMetadataTable[] = useMemo(() => {
    return schema?.database?.tables || [];
  }, [schema?.database]);

  const builderQuery: BuilderQueryExpression = query.azureLogAnalytics?.builderQuery || DEFAULT_LOGS_BUILDER_QUERY;

  const allColumns: AzureLogAnalyticsMetadataColumn[] = useMemo(() => {
    const tableName = builderQuery.from?.property.name;
    const selectedTable = tables.find((table) => table.name === tableName);
    return selectedTable?.columns || [];
  }, [builderQuery, tables]);

  const buildAndUpdateQuery = useCallback(
    ({
      limit,
      reduce,
      where,
      fuzzySearch,
      groupBy,
      orderBy,
      columns,
      from,
      basicLogsQuery,
    }: {
      limit?: number;
      reduce?: BuilderQueryEditorReduceExpression[];
      where?: BuilderQueryEditorWhereExpression[];
      fuzzySearch?: BuilderQueryEditorWhereExpression[];
      groupBy?: BuilderQueryEditorGroupByExpression[];
      orderBy?: BuilderQueryEditorOrderByExpression[];
      columns?: string[];
      from?: BuilderQueryEditorPropertyExpression;
      basicLogsQuery?: boolean;
    }) => {
      const datetimeColumn = allColumns.find((col) => col.type === 'datetime')?.name || 'TimeGenerated';

      const timeFilterExpression: BuilderQueryEditorWhereExpression = {
        type: BuilderQueryEditorExpressionType.Or,
        expressions: [
          {
            type: BuilderQueryEditorExpressionType.Operator,
            operator: { name: '$__timeFilter', value: datetimeColumn },
            property: { name: datetimeColumn, type: BuilderQueryEditorPropertyType.Datetime },
          },
        ],
      };

      const updatedBuilderQuery: BuilderQueryExpression = {
        ...builderQuery,
        ...(limit !== undefined ? { limit } : {}),
        ...(reduce !== undefined
          ? { reduce: { expressions: reduce, type: BuilderQueryEditorExpressionType.Reduce } }
          : {}),
        ...(where !== undefined ? { where: { expressions: where, type: BuilderQueryEditorExpressionType.And } } : {}),
        ...(fuzzySearch !== undefined
          ? { fuzzySearch: { expressions: fuzzySearch, type: BuilderQueryEditorExpressionType.And } }
          : {}),
        ...(groupBy !== undefined
          ? { groupBy: { expressions: groupBy, type: BuilderQueryEditorExpressionType.Group_by } }
          : {}),
        ...(orderBy !== undefined
          ? { orderBy: { expressions: orderBy, type: BuilderQueryEditorExpressionType.Order_by } }
          : {}),
        ...(columns !== undefined ? { columns: { columns, type: BuilderQueryEditorExpressionType.Property } } : {}),
        ...(from !== undefined ? { from } : {}),
        timeFilter: { expressions: [timeFilterExpression], type: BuilderQueryEditorExpressionType.And },
      };

      const updatedQueryString = AzureMonitorKustoQueryBuilder.toQuery(updatedBuilderQuery);

      onQueryChange({
        ...query,
        azureLogAnalytics: {
          ...query.azureLogAnalytics,
          builderQuery: updatedBuilderQuery,
          query: updatedQueryString,
          basicLogsQuery: from ? basicLogsQuery : query.azureLogAnalytics?.basicLogsQuery,
        },
      });
    },
    [query, builderQuery, onQueryChange, allColumns]
  );

  return (
    <span data-testid={selectors.components.queryEditor.logsQueryEditor.container.input}>
      <EditorRows>
        {schema && tables.length === 0 && (
          <Alert severity="warning" title="Resource loaded successfully but without any tables" />
        )}
        <TableSection
          {...props}
          tables={tables}
          allColumns={allColumns}
          buildAndUpdateQuery={buildAndUpdateQuery}
          isLoadingSchema={isLoadingSchema}
        />
        <FilterSection
          {...props}
          allColumns={allColumns}
          buildAndUpdateQuery={buildAndUpdateQuery}
          datasource={datasource}
          timeRange={timeRange}
        />
        <AggregateSection {...props} allColumns={allColumns} buildAndUpdateQuery={buildAndUpdateQuery} />
        <GroupBySection {...props} allColumns={allColumns} buildAndUpdateQuery={buildAndUpdateQuery} />
        <OrderBySection {...props} allColumns={allColumns} buildAndUpdateQuery={buildAndUpdateQuery} />
        <FuzzySearch {...props} allColumns={allColumns} buildAndUpdateQuery={buildAndUpdateQuery} />
        <LimitSection {...props} buildAndUpdateQuery={buildAndUpdateQuery} />
        <KQLPreview
          query={query.azureLogAnalytics?.query || ''}
          hidden={isKQLPreviewHidden}
          setHidden={setIsKQLPreviewHidden}
        />
      </EditorRows>
    </span>
  );
};
