import React, { useState } from 'react';

import { SelectableValue } from '@grafana/data';
import { EditorField, EditorFieldGroup, EditorList, EditorRow } from '@grafana/plugin-ui';

import {
  BuilderQueryEditorExpressionType,
  BuilderQueryEditorPropertyType,
  BuilderQueryEditorReduceExpression,
  BuilderQueryExpression,
} from '../../dataquery.gen';
import { AzureLogAnalyticsMetadataColumn, AzureMonitorQuery } from '../../types';

import AggregateItem from './AggregateItem';
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
    return;
  }

  const availableColumns: Array<SelectableValue<string>> = [];
  const columns = builderQuery.columns?.columns ?? [];

  if (columns.length > 0) {
    availableColumns.push(
      ...columns.map((col) => ({
        label: col,
        value: col,
      }))
    );
  } else {
    availableColumns.push(
      ...allColumns.map((col) => ({
        label: col.name,
        value: col.name,
      }))
    );
  }

  const onDeleteAggregate = (aggregateToDelete: Partial<BuilderQueryEditorReduceExpression>) => {
    setAggregates((prevAggregates) => {
      const updatedAggregates = prevAggregates.filter((agg) => agg.property?.name !== aggregateToDelete.property?.name);

      if (updatedAggregates.length === 0) {
        updateAggregatesAndQuery([]);
      } else {
        updateAggregatesAndQuery(updatedAggregates);
      }

      return updatedAggregates;
    });
  };

  const updateAggregatesAndQuery = (newAggregates: BuilderQueryEditorReduceExpression[]) => {
    const validAggregates = newAggregates.filter((agg) => agg.reduce?.name);

    const aggregation =
      validAggregates.length > 0
        ? validAggregates
            .map((agg) => {
              if (agg.reduce?.name === 'count' && agg.property?.name) {
                return `count(${agg.property.name})`;
              } else if (agg.reduce?.name === 'count') {
                return `count()`;
              }
              return `${agg.reduce.name}(${agg.property?.name})`;
            })
            .join(', ')
        : '';

    const updatedBuilderQuery: BuilderQueryExpression = {
      ...builderQuery,
      reduce: {
        expressions: validAggregates,
        type: BuilderQueryEditorExpressionType.Reduce,
      },
    };

    const filters = builderQuery.where?.expressions
      ?.map((exp) => {
        if ('property' in exp && exp.property?.name && exp.operator?.name && exp.operator?.value !== undefined) {
          return `${exp.property.name} ${exp.operator.name} ${exp.operator.value}`;
        }
        return null;
      })
      .filter((filter) => filter !== null)
      .join(' and ');

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
        onChange={onChange}
        onDelete={() => onDeleteAggregate(item)}
        columns={availableColumns}
      />
    );
  };
}
