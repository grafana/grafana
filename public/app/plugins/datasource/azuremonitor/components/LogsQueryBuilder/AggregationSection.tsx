import React, { useEffect, useRef, useState } from 'react';

import { SelectableValue } from '@grafana/data';
import { EditorField, EditorFieldGroup, EditorList, EditorRow } from '@grafana/plugin-ui';
import { Icon, Tooltip } from '@grafana/ui';

import {
  BuilderQueryEditorPropertyType,
  BuilderQueryEditorReduceExpression,
} from '../../dataquery.gen';
import { AzureLogAnalyticsMetadataColumn, AzureMonitorQuery } from '../../types';

import AggregateItem from './AggregateItem';
import { buildAndUpdateQuery } from './utils';

interface AggregateSectionProps {
  query: AzureMonitorQuery;
  allColumns: AzureLogAnalyticsMetadataColumn[];
  onQueryUpdate: (newQuery: AzureMonitorQuery) => void;
  templateVariableOptions: SelectableValue<string>;
}

export const AggregateSection: React.FC<AggregateSectionProps> = ({
  query,
  allColumns,
  onQueryUpdate,
  templateVariableOptions,
}) => {
  const [aggregates, setAggregates] = useState<BuilderQueryEditorReduceExpression[]>([]);
  const builderQuery = query.azureLogAnalytics?.builderQuery;
  const prevTable = useRef<string | null>(builderQuery?.from?.property.name || null);

  const hasLoadedAggregates = useRef(false);

  useEffect(() => {
    const currentTable = builderQuery?.from?.property.name || null;

    if (prevTable.current !== currentTable) {
      setAggregates([]);
      hasLoadedAggregates.current = false;
      prevTable.current = currentTable;
    }

    if (!hasLoadedAggregates.current && builderQuery?.reduce?.expressions?.length && aggregates.length === 0) {
      let parsedAggregates: BuilderQueryEditorReduceExpression[];

      const hasPercentile = builderQuery.reduce.expressions.find((r) => r.parameters);
      if (hasPercentile) {
        parsedAggregates = builderQuery.reduce.expressions
          .filter((agg) => agg.reduce?.name)
          .map((agg) => ({
            property: agg.property ?? { type: BuilderQueryEditorPropertyType.String, name: '' },
            reduce: agg.reduce ?? { name: '', type: BuilderQueryEditorPropertyType.Function },
            parameters: agg.parameters ?? [],
            focus: false,
          }));
        setAggregates(parsedAggregates);
      } else {
        parsedAggregates = builderQuery.reduce.expressions
          .filter((agg) => agg.reduce?.name)
          .map((agg) => ({
            property: agg.property ?? { type: BuilderQueryEditorPropertyType.String, name: '' },
            reduce: agg.reduce ?? { name: '', type: BuilderQueryEditorPropertyType.Function },
            focus: false,
          }));
        setAggregates(parsedAggregates);
      }

      hasLoadedAggregates.current = true;
    }
  }, [builderQuery, aggregates]);

  if (!builderQuery) {
    return <></>;
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
      const updatedAggregates = prevAggregates.filter(
        (agg) => agg.property?.name !== aggregateToDelete.property?.name
      );
  
      buildAndUpdateQuery({
        query,
        onQueryUpdate,
        allColumns,
        reduce: updatedAggregates.length === 0 ? [] : updatedAggregates,
      });
  
      return updatedAggregates;
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
    buildAndUpdateQuery({
      query,
      onQueryUpdate,
      allColumns,
      reduce: cleaned,
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
              renderItem={makeRenderAggregate(availableColumns, onDeleteAggregate, templateVariableOptions)}
            />
          </EditorField>
          <Tooltip
            content={
              <>
                Perform calculations across rows of data, such as count, sum, average, minimum, maximum, standard
                deviation or percentiles. Aggregates condense multiple rows into a single value based on mathematical
                operations applied to the data.{' '}
              </>
            }
            placement="right"
            interactive={true}
          >
            <Icon name="info-circle" />
          </Tooltip>
        </EditorFieldGroup>
      </EditorRow>
    </div>
  );
};

function makeRenderAggregate(
  availableColumns: Array<SelectableValue<string>>,
  onDeleteAggregate: (aggregate: Partial<BuilderQueryEditorReduceExpression>) => void,
  templateVariableOptions: SelectableValue<string>
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
        templateVariableOptions={templateVariableOptions}
      />
    );
  };
}
