import React, { useEffect, useMemo, useState } from 'react';

import { SelectableValue } from '@grafana/data';
import { EditorField, EditorFieldGroup, EditorList, EditorRow } from '@grafana/plugin-ui';

import { AzureLogAnalyticsMetadataColumn, QueryEditorPropertyType } from '../../types';

import { AggregateItem } from './AggregateItem';
import { QueryEditorExpressionType, QueryEditorReduceExpression } from './expressions';

interface AggregateSectionProps {
  selectedColumns: Array<SelectableValue<string>>;
  selectedTable: string;
  columns: AzureLogAnalyticsMetadataColumn[];
  onQueryUpdate: (params: { aggregates?: string; aggregateColumns?: Array<{ name: string; type: string }> }) => void;
  templateVariableOptions?: SelectableValue<string>;
}

export const AggregateSection: React.FC<AggregateSectionProps> = ({
  selectedColumns,
  selectedTable,
  columns,
  onQueryUpdate,
  templateVariableOptions,
}) => {
  const [aggregates, setAggregates] = useState<QueryEditorReduceExpression[]>([]);

  const selectableColumns: Array<SelectableValue<string>> = useMemo(
    () => columns.map((col) => ({ label: col.name, value: col.name })),
    [columns]
  );

  const availableColumns: Array<SelectableValue<string>> =
    selectedColumns.length > 0 ? selectedColumns : selectableColumns;

  useEffect(() => {
    setAggregates(() => {
      return [];
    });
  }, [selectedTable]);

  const updateQueryWithAggregates = (newAggregates: QueryEditorReduceExpression[]) => {
    const validAggregates = newAggregates.filter((agg) => agg.property?.name && agg.reduce?.name);

    if (validAggregates.length > 0) {
      const aggregation = validAggregates.map((agg) => `${agg.reduce.name}(${agg.property.name})`).join(', ');

      onQueryUpdate({
        aggregates: aggregation,
        aggregateColumns: validAggregates.map((agg) => ({
          name: agg.property.name,
          type: agg.property.type,
        })),
      });
    } else {
      onQueryUpdate({ aggregates: '', aggregateColumns: [] });
    }
  };

  const onChange = (newItems: Array<Partial<QueryEditorReduceExpression>>) => {
    const cleaned = newItems.map(
      (v): QueryEditorReduceExpression => ({
        type: QueryEditorExpressionType.Reduce,
        property: v.property ?? { type: QueryEditorPropertyType.String, name: '' },
        reduce: v.reduce ?? { name: '', type: QueryEditorPropertyType.String },
        parameters: v.parameters,
        focus: Object.keys(v).length === 0,
      })
    );

    setAggregates(cleaned);
    updateQueryWithAggregates(cleaned);
  };

  const onDeleteAggregate = (aggregateToDelete: Partial<QueryEditorReduceExpression>) => {
    setAggregates((prevAggregates) => {
      const updatedAggregates = prevAggregates.filter((agg) => agg.property?.name !== aggregateToDelete.property?.name);

      const aggregation = updatedAggregates.map((agg) => `${agg.reduce.name}(${agg.property.name})`).join(', ');
      const aggregateColumns = updatedAggregates.map((agg) => ({
        name: agg.property.name,
        type: agg.property.type,
      }));

      onQueryUpdate({ aggregates: aggregation, aggregateColumns });

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
        columns={availableColumns}
      />
    );
  };
}
