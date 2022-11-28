import { isEqual } from 'lodash';
import React, { useEffect, useState } from 'react';

import { EditorList } from '@grafana/experimental';

import { MultiFilters } from '../../types';

import { MultiFilterItem } from './MultiFilterItem';

export interface Props {
  filters?: MultiFilters;
  onChange: (filters: MultiFilters) => void;
  keyPlaceholder?: string;
}

export interface MultiFilterCondition {
  key?: string;
  operator?: string;
  value?: string[];
}

const multiFiltersToFilterConditions = (filters: MultiFilters) =>
  Object.keys(filters).map((key) => ({ key, value: filters[key], operator: '=' }));

const filterConditionsToMultiFilters = (filters: MultiFilterCondition[]) => {
  const res: MultiFilters = {};
  filters.forEach(({ key, value }) => {
    if (key && value) {
      res[key] = value;
    }
  });
  return res;
};

export const MultiFilter = ({ filters, onChange, keyPlaceholder }: Props) => {
  const [items, setItems] = useState<MultiFilterCondition[]>([]);
  useEffect(() => setItems(filters ? multiFiltersToFilterConditions(filters) : []), [filters]);
  const onFiltersChange = (newItems: Array<Partial<MultiFilterCondition>>) => {
    setItems(newItems);

    // The onChange event should only be triggered in the case there is a complete dimension object.
    // So when a new key is added that does not yet have a value, it should not trigger an onChange event.
    const newMultifilters = filterConditionsToMultiFilters(newItems);
    if (!isEqual(newMultifilters, filters)) {
      onChange(newMultifilters);
    }
  };

  return <EditorList items={items} onChange={onFiltersChange} renderItem={makeRenderFilter(keyPlaceholder)} />;
};

function makeRenderFilter(keyPlaceholder?: string) {
  function renderFilter(
    item: MultiFilterCondition,
    onChange: (item: MultiFilterCondition) => void,
    onDelete: () => void
  ) {
    return (
      <MultiFilterItem
        filter={item}
        onChange={(item) => onChange(item)}
        onDelete={onDelete}
        keyPlaceholder={keyPlaceholder}
      />
    );
  }
  return renderFilter;
}
