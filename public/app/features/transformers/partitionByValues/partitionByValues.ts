import { map } from 'rxjs';

import {
  ArrayVector,
  DataFrame,
  DataTransformerID,
  SynchronousDataTransformerInfo,
  getFieldMatcher,
} from '@grafana/data';
import { getMatcherConfig } from '@grafana/data/src/transformations/transformers/filterByName';
import { noopTransformer } from '@grafana/data/src/transformations/transformers/noop';

import { partition } from './partition';

export interface FrameNamingOptions {
  /** whether to append to existing frame name, false -> replace */
  append?: boolean; // false
  /** whether to include discriminator field names, e.g. true -> Region=Europe Profession=Chef, false -> 'Europe Chef'  */
  withFields?: boolean; // false
  /** name/value separator, e.g. '=' in 'Region=Europe' */
  separator1?: string;
  /** name/value pair separator, e.g. ' ' in 'Region=Europe Profession=Chef' */
  separator2?: string;
}

const defaultFrameNameOptions: FrameNamingOptions = {
  append: false,
  withFields: false,
  separator1: '=',
  separator2: ' ',
};

export interface PartitionByValuesTransformerOptions {
  /** field names whose values should be used as discriminator keys (typically enum fields) */
  fields: string[];
  /** how the split frames' names should be suffixed (ends up as field prefixes) */
  naming?: FrameNamingOptions;
}

function buildFrameName(opts: FrameNamingOptions, names: string[], values: unknown[]): string {
  return names
    .map((name, i) => (opts.withFields ? `${name}${opts.separator1}${values[i]}` : values[i]))
    .join(opts.separator2);
}

export const partitionByValuesTransformer: SynchronousDataTransformerInfo<PartitionByValuesTransformerOptions> = {
  id: DataTransformerID.partitionByValues,
  name: 'Partition by values',
  description: `Splits a one-frame dataset into multiple series discriminated by unique/enum values in one or more fields.`,
  defaultOptions: {},

  operator: (options) => (source) =>
    source.pipe(map((data) => partitionByValuesTransformer.transformer(options)(data))),

  transformer: (options: PartitionByValuesTransformerOptions) => {
    const matcherConfig = getMatcherConfig({ names: options.fields });

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
        ...options.naming,
      };

      return partition(keyFieldsVals).map((idxs: number[]) => {
        let name = buildFrameName(
          frameNameOpts,
          names,
          keyFields.map((f, i) => keyFieldsVals[i][idxs[0]])
        );

        if (options.naming?.append && frame.name) {
          name = `${frame.name} ${name}`;
        }

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
