import { isEqual } from 'lodash';
import React, { useEffect, useState } from 'react';
import { SelectableValue } from '@grafana/data';
import { EditorList } from '@grafana/experimental';
import { CloudWatchDatasource } from '../../datasource';
import { Dimensions as DimensionsType, DimensionsQuery } from '../../types';
import { FilterItem } from './FilterItem';

export interface Props {
  query: DimensionsQuery;
  onChange: (dimensions: DimensionsType) => void;
  datasource: CloudWatchDatasource;
  dimensionKeys: Array<SelectableValue<string>>;
  disableExpressions: boolean;
}

export interface DimensionFilterCondition {
  key?: string;
  operator?: string;
  value?: string;
}

const dimensionsToFilterConditions = (dimensions: DimensionsType | undefined) =>
  Object.entries(dimensions ?? {}).reduce<DimensionFilterCondition[]>((acc, [key, value]) => {
    if (value && typeof value === 'string') {
      const filter = {
        key,
        value,
        operator: '=',
      };
      return [...acc, filter];
    }
    return acc;
  }, []);

const filterConditionsToDimensions = (filters: DimensionFilterCondition[]) => {
  return filters.reduce<DimensionsType>((acc, { key, value }) => {
    if (key && value) {
      return { ...acc, [key]: value };
    }
    return acc;
  }, {});
};

export const Dimensions: React.FC<Props> = ({ query, datasource, dimensionKeys, disableExpressions, onChange }) => {
  const [items, setItems] = useState<DimensionFilterCondition[]>([]);
  useEffect(() => setItems(dimensionsToFilterConditions(query.dimensions)), [query.dimensions]);
  const onDimensionsChange = (newItems: Array<Partial<DimensionFilterCondition>>) => {
    setItems(newItems);

    // The onChange event should only be triggered in the case there is a complete dimension object.
    // So when a new key is added that does not yet have a value, it should not trigger an onChange event.
    const newDimensions = filterConditionsToDimensions(newItems);
    if (!isEqual(newDimensions, query.dimensions)) {
      onChange(newDimensions);
    }
  };

  return (
    <EditorList
      items={items}
      onChange={onDimensionsChange}
      renderItem={makeRenderFilter(datasource, query, dimensionKeys, disableExpressions)}
    />
  );
};

function makeRenderFilter(
  datasource: CloudWatchDatasource,
  query: DimensionsQuery,
  dimensionKeys: Array<SelectableValue<string>>,
  disableExpressions: boolean
) {
  function renderFilter(
    item: DimensionFilterCondition,
    onChange: (item: DimensionFilterCondition) => void,
    onDelete: () => void
  ) {
    return (
      <FilterItem
        filter={item}
        onChange={(item) => onChange(item)}
        datasource={datasource}
        query={query}
        disableExpressions={disableExpressions}
        dimensionKeys={dimensionKeys}
        onDelete={onDelete}
      />
    );
  }

  return renderFilter;
}
