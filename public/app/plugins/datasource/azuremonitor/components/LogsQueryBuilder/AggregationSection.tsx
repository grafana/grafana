import React, { useEffect, useMemo, useState } from 'react';

import { SelectableValue } from '@grafana/data';
import { EditorField, EditorFieldGroup, EditorList, EditorRow } from '@grafana/plugin-ui';

import { BuilderQueryEditorExpressionType, BuilderQueryEditorPropertyType, BuilderQueryEditorReduceExpression, BuilderQueryExpression } from '../../dataquery.gen';
import { AzureLogAnalyticsMetadataColumn, AzureMonitorQuery } from '../../types';

import { AggregateItem } from './AggregateItem';
import { AzureMonitorKustoQueryParser } from './AzureMonitorKustoQueryParser';

interface AggregateSectionProps {
  query: AzureMonitorQuery;
  allColumns: AzureLogAnalyticsMetadataColumn[];
  onQueryUpdate: (newQuery: AzureMonitorQuery) => void;
  templateVariableOptions?: SelectableValue<string>;
}

export const AggregateSection: React.FC<AggregateSectionProps> = ({
  query,
  allColumns,
  onQueryUpdate,
  templateVariableOptions,
}) => {
  const [aggregates, setAggregates] = useState<BuilderQueryEditorReduceExpression[]>([]);
  const builderQuery = query.azureLogAnalytics?.builderQuery;

  if (!builderQuery) {
    return null; // If builderQuery is not available, don't render
  }

  const availableColumns: Array<SelectableValue<string>> = useMemo(() => {
    const columns = builderQuery.columns?.columns;

    if (columns?.length) {
      return columns.map((col) => ({
        label: col,
        value: col,
      }));
    }

    return allColumns.map((col) => ({
      label: col.name,
      value: col.name,
    }));
  }, [builderQuery.columns?.columns, allColumns]);

  useEffect(() => {
    setAggregates(() => {
      return [];
    });
  }, [builderQuery.from?.property.name]);

  // Update both state and query string with aggregates
  const updateAggregatesAndQuery = (newAggregates: BuilderQueryEditorReduceExpression[]) => {
    const validAggregates = newAggregates.filter((agg) => agg.property?.name && agg.reduce?.name);
    const aggregation = validAggregates.length > 0
      ? validAggregates.map((agg) => `${agg.reduce.name}(${agg.property.name})`).join(', ')
      : '';

    const updatedBuilderQuery: BuilderQueryExpression = {
      ...query.azureLogAnalytics?.builderQuery,
      reduce: {
        expressions: validAggregates,
        type: BuilderQueryEditorExpressionType.Reduce,
      },
    };

    const updatedQueryString = AzureMonitorKustoQueryParser.toQuery({
      selectedTable: builderQuery.from?.property.name!,
      selectedColumns: [],
      columns: allColumns,
      aggregation,
    });

    onQueryUpdate({
      ...query,
      azureLogAnalytics: {
        ...query.azureLogAnalytics,
        builderQuery: updatedBuilderQuery,
        query: updatedQueryString,
      },
    });
  };

  const onChange = (newItems: Array<Partial<BuilderQueryEditorReduceExpression>>) => {
    const cleaned = newItems.map(
      (v): BuilderQueryEditorReduceExpression => ({
        property: v.property ?? { type: BuilderQueryEditorPropertyType.String, name: '' },
        reduce: v.reduce ?? { name: '', type: BuilderQueryEditorPropertyType.String },
        parameters: v.parameters,
        focus: Object.keys(v).length === 0,
      })
    );

    setAggregates(cleaned);
    updateAggregatesAndQuery(cleaned);
  };

  const onDeleteAggregate = (aggregateToDelete: Partial<BuilderQueryEditorReduceExpression>) => {
    setAggregates((prevAggregates) => {
      const updatedAggregates = prevAggregates.filter((agg) => agg.property?.name !== aggregateToDelete.property?.name);
      updateAggregatesAndQuery(updatedAggregates);  // Rebuild the query
      return updatedAggregates;
    });
  };

  return (
    <div data-testid="aggregate-section">
      <EditorRow>
        <EditorFieldGroup>
          <EditorField label="Aggregate" optional={true}>
            <EditorList
              items={aggregates}
              onChange={onChange}
              renderItem={makeRenderAggregate(availableColumns, onDeleteAggregate)}
            />
          </EditorField>
        </EditorFieldGroup>
      </EditorRow>
    </div>
  );
};

function makeRenderAggregate(
  availableColumns: Array<SelectableValue<string>>,
  onDeleteAggregate: (aggregate: Partial<BuilderQueryEditorReduceExpression>) => void
) {
  return function renderAggregate(
    item: Partial<BuilderQueryEditorReduceExpression>,
    onChange: (item: BuilderQueryEditorReduceExpression) => void
  ) {
    return (
      <AggregateItem
        aggregate={item}
        onChange={onChange} // Pass the onChange function to update parent state
        onDelete={() => onDeleteAggregate(item)} // Pass the onDelete function to delete the aggregate
        columns={availableColumns}
      />
    );
  };
}
