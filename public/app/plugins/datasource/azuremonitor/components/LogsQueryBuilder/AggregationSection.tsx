import React, { useEffect, useRef, useState } from 'react';

import { SelectableValue } from '@grafana/data';
import { EditorField, EditorFieldGroup, EditorList, EditorRow } from '@grafana/plugin-ui';

import { BuilderQueryEditorReduceExpression } from '../../dataquery.gen';
import { AzureLogAnalyticsMetadataColumn, AzureMonitorQuery } from '../../types';

import AggregateItem from './AggregateItem';
import { BuildAndUpdateOptions } from './utils';

interface AggregateSectionProps {
  query: AzureMonitorQuery;
  allColumns: AzureLogAnalyticsMetadataColumn[];
  templateVariableOptions: SelectableValue<string>;
  buildAndUpdateQuery: (options: Partial<BuildAndUpdateOptions>) => void;
}
export const AggregateSection: React.FC<AggregateSectionProps> = ({
  query,
  allColumns,
  buildAndUpdateQuery,
  templateVariableOptions,
}) => {
  const builderQuery = query.azureLogAnalytics?.builderQuery;
  const [aggregates, setAggregates] = useState<BuilderQueryEditorReduceExpression[]>(
    builderQuery?.reduce?.expressions || []
  );
  const prevTable = useRef<string | null>(builderQuery?.from?.property.name || null);
  const hasLoadedAggregates = useRef(false);

  useEffect(() => {
    const currentTable = builderQuery?.from?.property.name || null;

    if (prevTable.current !== currentTable || builderQuery?.reduce?.expressions.length === 0) {
      setAggregates([]);
      hasLoadedAggregates.current = false;
      prevTable.current = currentTable;
    }
  }, [builderQuery]);

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
              renderItem={makeRenderAggregate(availableColumns, onDeleteAggregate, templateVariableOptions)}
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
  templateVariableOptions: SelectableValue<string>
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
        templateVariableOptions={templateVariableOptions}
      />
    );
  };
}
