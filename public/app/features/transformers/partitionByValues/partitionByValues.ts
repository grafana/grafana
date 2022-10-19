import { map } from 'rxjs';

import {
  ArrayVector,
  DataFrame,
  DataTransformerID,
  SynchronousDataTransformerInfo,
  getFieldMatcher,
  RegexpOrNamesMatcherOptions,
} from '@grafana/data';
import { getMatcherConfig } from '@grafana/data/src/transformations/transformers/filterByName';
import { noopTransformer } from '@grafana/data/src/transformations/transformers/noop';

import { partition } from './partition';

export interface FrameNameOptions {
  /** if false, will only include values without key field names, e.g. 'Europe Chef' */
  names?: boolean; // false
  /** name/value separator, e.g. '=' in 'Region=Europe' */
  separator1?: string;
  /** name/value pair separator, e.g. ' ' in 'Region=Europe Profession=Chef' */
  separator2?: string;
}

const defaultFrameNameOptions: FrameNameOptions = {
  names: false,
  separator1: '=',
  separator2: ' ',
};

export interface PartitionByValuesTransformerOptions {
  /** field names whose values should be used as discriminator keys (typically enum fields) */
  fields: RegexpOrNamesMatcherOptions;

  /** how the split frames should be named (ends up as field prefixes) */
  frameName?: FrameNameOptions;
}

function buildFrameName(opts: FrameNameOptions, names: string[], values: unknown[]): string {
  return names
    .map((name, i) => (opts.names ? `${name}${opts.separator1}${values[i]}` : values[i]))
    .join(opts.separator2);
}

export const partitionByValuesTransformer: SynchronousDataTransformerInfo<PartitionByValuesTransformerOptions> = {
  id: DataTransformerID.partitionByValues,
  name: 'Partition by values',
  description: `Splits a combined dataset into multiple series discriminated by unique values in one or more chosen fields.`,
  defaultOptions: {},

  operator: (options) => (source) =>
    source.pipe(map((data) => partitionByValuesTransformer.transformer(options)(data))),

  transformer: (options: PartitionByValuesTransformerOptions) => {
    const matcherConfig = getMatcherConfig(options.fields);

    if (!matcherConfig) {
      return noopTransformer.transformer({});
    }

    const matcher = getFieldMatcher(matcherConfig);

    return (data: DataFrame[]) => {
      if (!data.length) {
        return data;
      }

      const frame = data[0];
      const keyFields = frame.fields.filter((f) => matcher!(f, frame, data))!;
      const keyFieldsVals = keyFields.map((f) => f.values.toArray());
      const names = keyFields.map((f) => f.name);

      const frameNameOpts = {
        ...defaultFrameNameOptions,
        ...options.frameName,
      };

      return partition(keyFieldsVals).map((idxs: number[]) => {
        const name = buildFrameName(
          frameNameOpts,
          names,
          keyFields.map((f, i) => keyFieldsVals[i][idxs[0]])
        );

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
