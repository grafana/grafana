import React from 'react';

import { DataTransformerID, standardTransformers, TransformerRegistryItem, TransformerUIProps } from '@grafana/data';
import { FilterFieldsByValuesTransformerOptions } from '@grafana/data/src/transformations/transformers/filterFieldByValue';

export const FilterFieldsByValuesTransformerEditor: React.FC<
  TransformerUIProps<FilterFieldsByValuesTransformerOptions>
> = ({}) => {
  return <div></div>;
};

export const filterFieldsByValuesTransformRegistryItem: TransformerRegistryItem<FilterFieldsByValuesTransformerOptions> =
  {
    id: DataTransformerID.filterFieldsByValue,
    editor: FilterFieldsByValuesTransformerEditor,
    transformation: standardTransformers.filterFieldsByValuesTransformer,
    name: 'Filter fields by values',
    description: 'Removes part of query where all values match a predicate',
  };
