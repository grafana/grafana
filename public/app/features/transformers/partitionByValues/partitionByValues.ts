import { map } from 'rxjs';

import {
  ArrayVector,
  DataFrame,
  DataTransformerID,
  SynchronousDataTransformerInfo,
  getFieldMatcher,
} from '@grafana/data';
import {
  FilterFieldsByNameTransformerOptions,
  getMatcherConfig,
} from '@grafana/data/src/transformations/transformers/filterByName';
import { noopTransformer } from '@grafana/data/src/transformations/transformers/noop';

import { partition } from './partition';

export const partitionByValuesTransformer: SynchronousDataTransformerInfo<FilterFieldsByNameTransformerOptions> = {
  id: DataTransformerID.partitionByValues,
  name: 'Partition by values',
  description: `Splits a combined dataset into multiple series discriminated by unique values in one or more chosen fields.`,
  defaultOptions: {},

  operator: (options) => (source) =>
    source.pipe(map((data) => partitionByValuesTransformer.transformer(options)(data))),

  transformer: (options: FilterFieldsByNameTransformerOptions) => {
    const matcherConfig = getMatcherConfig(options.include);
    if (!matcherConfig) {
      return noopTransformer.transformer({});
    }
    const matcher = getFieldMatcher(matcherConfig);

    // TODO docs+errors? around this only applyign to the first frame?
    return (data: DataFrame[]) => {
      if (!data.length) {
        return data;
      }
      const frame = data[0]; // only the first frame?  should this work for all?
      const keyFields = frame.fields.filter((f) => matcher!(f, frame, data))!;
      const keys = keyFields.map((f) => f.values.toArray());
      return partition(keys).map((idxs: number[]) => {
        const name = keyFields.map((f, i) => keys[i][idxs[0]]).join('/');

        return {
          ...frame,
          name,
          length: idxs.length,
          fields: frame.fields.map((f) => {
            const vals = f.values.toArray();
            const vals2 = Array(idxs.length);

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
    };
  },
};
