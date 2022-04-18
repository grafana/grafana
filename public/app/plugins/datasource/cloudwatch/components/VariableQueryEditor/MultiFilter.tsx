import { isEqual } from 'lodash';
import React, { useEffect, useState } from 'react';
import { EditorList } from '@grafana/experimental';
import { MultiFilters } from '../../types';
import { MultiFilterItem } from './MultiFilterItem';

export interface Props {
  filters?: MultiFilters;
  onChange: (filters: MultiFilters) => void;
}

export interface MultiFilterCondition {
  key?: string;
  operator?: string;
  value?: string[];
}

const multiFiltersToFilterConditions = (filters: MultiFilters | undefined) =>
  Object.entries(filters ?? {}).reduce<MultiFilterCondition[]>((acc, [key, value]) => {
    if (value && typeof value === 'object') {
      const filter = {
        key,
        value,
        operator: '=',
      };
      return [...acc, filter];
    }
    return acc;
  }, []);

const filterConditionsToMultiFilters = (filters: MultiFilterCondition[]) => {
  return filters.reduce<MultiFilters>((acc, { key, value }) => {
    if (key && value) {
      return { ...acc, [key]: value };
    }
    return acc;
  }, {});
};

export const MultiFilter: React.FC<Props> = ({ filters, onChange }) => {
  const [items, setItems] = useState<MultiFilterCondition[]>([]);
  useEffect(() => setItems(multiFiltersToFilterConditions(filters)), [filters]);
  const onFiltersChange = (newItems: Array<Partial<MultiFilterCondition>>) => {
    setItems(newItems);

    // The onChange event should only be triggered in the case there is a complete dimension object.
    // So when a new key is added that does not yet have a value, it should not trigger an onChange event.
    const newMultifilters = filterConditionsToMultiFilters(newItems);
    if (!isEqual(newMultifilters, filters)) {
      onChange(newMultifilters);
    }
  };

  return <EditorList items={items} onChange={onFiltersChange} renderItem={renderFilter} />;
};

function renderFilter(
  item: MultiFilterCondition,
  onChange: (item: MultiFilterCondition) => void,
  onDelete: () => void
) {
  return <MultiFilterItem filter={item} onChange={(item) => onChange(item)} onDelete={onDelete} />;
}
