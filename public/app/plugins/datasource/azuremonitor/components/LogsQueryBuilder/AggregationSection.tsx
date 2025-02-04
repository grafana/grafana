import React, { useState } from 'react';

import { SelectableValue } from '@grafana/data';
import { EditorField, EditorFieldGroup, EditorList, EditorRow } from '@grafana/plugin-ui';

import { AzureMonitorQuery } from '../../types';

import { AggregateItem } from './AggregateItem';
import {
  formatKQLQuery,
  QueryEditorExpression,
  QueryEditorExpressionType,
  QueryEditorPropertyType,
  QueryEditorReduceExpression,
} from './utils';

interface AggregateSectionProps {
  query: AzureMonitorQuery;
  onChange: (query: AzureMonitorQuery) => void;
  selectedColumns: SelectableValue<string>;
  templateVariableOptions?: SelectableValue<string>;
}

export const AggregateSection: React.FC<AggregateSectionProps> = ({
  query,
  selectedColumns,
  onChange: onQueryChange,
  templateVariableOptions,
}) => {
  const [aggregates, setAggregates] = useState<QueryEditorReduceExpression[]>([]);

  const updateQueryWithAggregates = (newAggregates: QueryEditorReduceExpression[]) => {
    const validAggregates = newAggregates.filter((agg) => agg.property?.name && agg.reduce?.name);

    let baseQuery = query.azureLogAnalytics?.query || '';

    if (validAggregates.length === 0) {
      // If no aggregates are left, remove summarize clause
      baseQuery = baseQuery.replace(/\| summarize .*/, '').trim();
    } else {
      const aggregateClauses = validAggregates.map((agg) => `${agg.reduce.name}(${agg.property.name})`).join(', ');

      baseQuery = baseQuery.includes('| summarize')
        ? baseQuery.replace(/\| summarize .*/, `| summarize ${aggregateClauses}`)
        : `${baseQuery} | summarize ${aggregateClauses}`;
    }

    const formattedQuery = formatKQLQuery(baseQuery);

    onQueryChange({
      ...query,
      azureLogAnalytics: {
        ...query.azureLogAnalytics,
        query: formattedQuery,
      },
    });
  };

  const onChange = (newItems: Array<Partial<QueryEditorReduceExpression>>) => {
    const cleaned = newItems.map((v): QueryEditorReduceExpression => {
      const isNewItem = Object.keys(v).length === 0;
      return {
        type: QueryEditorExpressionType.Reduce,
        property: v.property ?? { type: QueryEditorPropertyType.String, name: '' },
        reduce: v.reduce ?? { name: '', type: QueryEditorPropertyType.String },
        parameters: v.parameters,
        focus: isNewItem,
      };
    });

    setAggregates(cleaned);
    updateQueryWithAggregates(cleaned);
  };

  const onDeleteAggregate = (aggregateToDelete: Partial<QueryEditorReduceExpression>) => {
    setAggregates((prevAggregates) => {
      const updatedAggregates = prevAggregates.filter((agg) => agg !== aggregateToDelete);
      updateQueryWithAggregates(updatedAggregates);
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
              renderItem={makeRenderAggregate(query, selectedColumns, templateVariableOptions, onDeleteAggregate)}
            />
          </EditorField>
        </EditorFieldGroup>
      </EditorRow>
    </div>
  );
};

function makeRenderAggregate(
  query: AzureMonitorQuery,
  columns: SelectableValue<string> | undefined,
  templateVariableOptions: SelectableValue<string> | undefined,
  onDeleteAggregate: (aggregate: Partial<QueryEditorReduceExpression>) => void
) {
  return function renderAggregate(
    item: Partial<QueryEditorReduceExpression>,
    onChange: (item: QueryEditorExpression) => void,
    onDelete: () => void
  ) {
    return (
      <AggregateItem
        query={query}
        aggregate={item}
        onChange={onChange}
        onDelete={() => onDeleteAggregate(item)}
        columns={columns}
        templateVariableOptions={templateVariableOptions}
      />
    );
  };
}
