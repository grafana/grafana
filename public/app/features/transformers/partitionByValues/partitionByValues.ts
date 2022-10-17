import { map } from 'rxjs';

import {
  ArrayVector,
  DataFrame,
  DataTransformerID,
  PluginState,
  SynchronousDataTransformerInfo,
  TransformerRegistryItem,
  getFieldMatcher,
  FieldMatcher,
} from '@grafana/data';
import {
  FilterFieldsByNameTransformerOptions,
  getMatcherConfig,
} from '@grafana/data/src/transformations/transformers/filterByName';

import { FilterByNameTransformerEditor } from '../editors/FilterByNameTransformerEditor';

import { partition } from './partition';

export const partitionByValuesTransformer: SynchronousDataTransformerInfo<FilterFieldsByNameTransformerOptions> = {
  id: DataTransformerID.partitionByValues,
  name: 'Partition by values',
  description: `Splits a combined dataset into multiple series discriminated by unique values in one or more chosen fields.`,
  defaultOptions: {},

  operator: (options) => (source) =>
    source.pipe(map((data) => partitionByValuesTransformer.transformer(options)(data))),

  transformer: (options: FilterFieldsByNameTransformerOptions) => {
    let matcher: FieldMatcher | undefined;

    if (options.include) {
      matcher = getFieldMatcher(getMatcherConfig(options.include)!);
    }

    return (data: DataFrame[]) => {
      if (!matcher || !data.length) {
        return data;
      }

      let keyFields = data[0].fields.filter((f) => matcher!(f, data[0], data))!;
      let keys = keyFields.map((f) => f.values.toArray());
      let frames = partition(keys).map((idxs: number[]) => {
        let name = keyFields.map((f, i) => keys[i][idxs[0]]).join('/');

        return {
          ...data[0],
          name,
          length: idxs.length,
          fields: data[0].fields.map((f) => {
            let vals = f.values.toArray();
            let vals2 = Array(idxs.length);

            for (let i = 0; i < idxs.length; i++) {
              vals2[i] = vals[idxs[i]];
            }

            return {
              ...f,
              state: undefined,
              values: new ArrayVector(vals2),
            };
          }),
        };
      });

      return frames;
    };
  },
};

export const partitionByValuesTransformRegistryItem: TransformerRegistryItem<FilterFieldsByNameTransformerOptions> = {
  id: DataTransformerID.partitionByValues,
  editor: FilterByNameTransformerEditor,
  transformation: partitionByValuesTransformer,
  name: partitionByValuesTransformer.name,
  description: partitionByValuesTransformer.description,
  state: PluginState.alpha,
};
