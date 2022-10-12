import { map } from 'rxjs';

import {
  ArrayVector,
  DataFrame,
  DataTransformerID,
  PluginState,
  SynchronousDataTransformerInfo,
  TransformerRegistryItem,
} from '@grafana/data';

import { PartitionByValuesEditor } from './PartitionByValuesEditor';
import { partition } from './partition';

interface PartitionByValuesOptions {
  fields: string[];
}

export const partitionByValuesTransformer: SynchronousDataTransformerInfo<PartitionByValuesOptions> = {
  id: DataTransformerID.partitionByValues,
  name: 'Partition by values',
  description: `Will split a combined dataset into multiple series discriminated by unique values in one or more chosen fields.`,
  defaultOptions: {},

  operator: (options) => (source) =>
    source.pipe(map((data) => partitionByValuesTransformer.transformer(options)(data))),

  transformer: (options: PartitionByValuesOptions) => {
    return (data: DataFrame[]) => {
      let keyField = data[0].fields.find((f) => f.name === 'Gender')!
      let keys = keyField.values.toArray();
      let frames = partition([keys]).map((idxs: number[]) => {
        return {
          ...data[0],
          name: keyField.name + '/' + keyField.values.get(idxs[0]),
          length: idxs.length,
          fields: data[0].fields.map((f) => {
            let vals = f.values.toArray();
            let vals2 = Array(idxs.length);

            for (let i = 0; i < idxs.length; i++) {
              vals2[i] = vals[idxs[i]];
            }

            return {
              ...f,
              values: new ArrayVector(vals2),
            };
          })
        }
      });

      return frames;
    };
  },
};

export const partitionByValuesTransformRegistryItem: TransformerRegistryItem<PartitionByValuesOptions> = {
  id: DataTransformerID.partitionByValues,
  editor: PartitionByValuesEditor,
  transformation: partitionByValuesTransformer,
  name: partitionByValuesTransformer.name,
  description: partitionByValuesTransformer.description,
  state: PluginState.alpha,
};
