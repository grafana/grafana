import React, { useEffect, useRef, useState } from 'react';

import { SelectableValue } from '@grafana/data';
import { EditorField, EditorFieldGroup, EditorList, EditorRow } from '@grafana/plugin-ui';

import { BuilderQueryEditorPropertyType, BuilderQueryEditorReduceExpression } from '../../dataquery.gen';
import { AzureLogAnalyticsMetadataColumn, AzureMonitorOption, AzureMonitorQuery } from '../../types';

import AggregateItem from './AggregateItem';
import { BuildAndUpdateOptions } from './utils';

interface AggregateSectionProps {
  query: AzureMonitorQuery;
  allColumns: AzureLogAnalyticsMetadataColumn[];
  variableOptionGroup: { label: string; options: AzureMonitorOption[] };
  buildAndUpdateQuery: (options: Partial<BuildAndUpdateOptions>) => void;
}
export const AggregateSection: React.FC<AggregateSectionProps> = ({
  query,
  allColumns,
  buildAndUpdateQuery,
  variableOptionGroup,
}) => {
  const [aggregates, setAggregates] = useState<BuilderQueryEditorReduceExpression[]>([]);
  const builderQuery = query.azureLogAnalytics?.builderQuery;
  const prevTable = useRef<string | null>(builderQuery?.from?.property.name || null);
  const hasLoadedAggregates = useRef(false);

  useEffect(() => {
    const currentTable = builderQuery?.from?.property.name || null;

    if (prevTable.current !== currentTable || builderQuery?.reduce?.expressions.length === 0) {
      setAggregates([]);
      hasLoadedAggregates.current = false;
      prevTable.current = currentTable;
    }

    if (!hasLoadedAggregates.current && builderQuery?.reduce?.expressions?.length && aggregates.length === 0) {
      const parsed = builderQuery.reduce.expressions.map((agg) => ({
        property: agg.property ?? { type: BuilderQueryEditorPropertyType.String, name: '' },
        reduce: agg.reduce ?? { name: '', type: BuilderQueryEditorPropertyType.Function },
        parameters: agg.parameters,
        focus: false,
      }));
      setAggregates(parsed);
      hasLoadedAggregates.current = true;
    }
  }, [builderQuery, aggregates]);

  const availableColumns: Array<SelectableValue<string>> = builderQuery?.columns?.columns?.length
    ? builderQuery.columns.columns.map((col) => ({ label: col, value: col }))
    : allColumns.map((col) => ({ label: col.name, value: col.name }));

  const onChange = (newItems: Array<Partial<BuilderQueryEditorReduceExpression>>) => {
    setAggregates(newItems);

    buildAndUpdateQuery({
      reduce: newItems,
    });
  };

  const onDeleteAggregate = (aggregateToDelete: BuilderQueryEditorReduceExpression) => {
    setAggregates((prevAggregates) => {
      const updatedAggregates = prevAggregates.filter(
        (agg) =>
          agg.property?.name !== aggregateToDelete.property?.name || agg.reduce?.name !== aggregateToDelete.reduce?.name
      );

      buildAndUpdateQuery({
        reduce: updatedAggregates.length === 0 ? [] : updatedAggregates,
      });

      return updatedAggregates;
    });
  };

  return (
    <div data-testid="aggregate-section">
      <EditorRow>
        <EditorFieldGroup>
          <EditorField
            label="Aggregate"
            optional={true}
            tooltip={`Perform calculations across rows of data, such as count, sum, average, minimum, maximum, standard deviation or percentiles.`}
          >
            <EditorList
              items={aggregates}
              onChange={onChange}
              renderItem={makeRenderAggregate(availableColumns, onDeleteAggregate, variableOptionGroup)}
            />
          </EditorField>
        </EditorFieldGroup>
      </EditorRow>
    </div>
  );
};

function makeRenderAggregate(
  availableColumns: Array<SelectableValue<string>>,
  onDeleteAggregate: (aggregate: BuilderQueryEditorReduceExpression) => void,
  variableOptionGroup: { label: string; options: AzureMonitorOption[] }
) {
  return function renderAggregate(
    item: BuilderQueryEditorReduceExpression,
    onChange: (item: BuilderQueryEditorReduceExpression) => void
  ) {
    return (
      <AggregateItem
        aggregate={item}
        onChange={onChange}
        onDelete={() => onDeleteAggregate(item)}
        columns={availableColumns}
        variableOptionGroup={variableOptionGroup}
      />
    );
  };
}
