import React, { useEffect, useState } from 'react';

import { SelectableValue } from '@grafana/data';
import { EditorField, EditorFieldGroup, EditorList, EditorRow } from '@grafana/plugin-ui';

import { QueryEditorPropertyType } from '../../types';

import { AggregateItem } from './AggregateItem';
import { QueryEditorExpressionType, QueryEditorReduceExpression } from './expressions';

interface AggregateSectionProps {
  selectedColumns: Array<SelectableValue<string>>;
  onQueryUpdate: (params: { aggregates?: string }) => void;
  templateVariableOptions?: SelectableValue<string>;
}

export const AggregateSection: React.FC<AggregateSectionProps> = ({
  selectedColumns,
  onQueryUpdate,
  templateVariableOptions,
}) => {
  const [aggregates, setAggregates] = useState<QueryEditorReduceExpression[]>([]);

  useEffect(() => {
    if (selectedColumns.length === 0) {
      setAggregates([]); 
    }
  }, [selectedColumns]);

  const updateQueryWithAggregates = (newAggregates: QueryEditorReduceExpression[]) => {
    const validAggregates = newAggregates.filter((agg) => agg.property?.name && agg.reduce?.name);

    if (validAggregates.length > 0) {
      const aggregation = validAggregates.map((agg) => `${agg.reduce.name}(${agg.property.name})`).join(', ');

      onQueryUpdate({ aggregates: aggregation });
    }
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
              renderItem={makeRenderAggregate(selectedColumns, templateVariableOptions, onDeleteAggregate)}
            />
          </EditorField>
        </EditorFieldGroup>
      </EditorRow>
    </div>
  );
};

function makeRenderAggregate(
  columns: Array<SelectableValue<string>>,
  templateVariableOptions: SelectableValue<string> | undefined,
  onDeleteAggregate: (aggregate: Partial<QueryEditorReduceExpression>) => void
) {
  return function renderAggregate(
    item: Partial<QueryEditorReduceExpression>,
    onChange: (item: QueryEditorReduceExpression) => void
  ) {
    return (
      <AggregateItem
        aggregate={item}
        onChange={onChange}
        onDelete={() => onDeleteAggregate(item)}
        columns={columns}
        templateVariableOptions={templateVariableOptions}
      />
    );
  };
}
