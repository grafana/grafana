import { map } from 'rxjs';

import {
  DataFrame,
  DataTransformerID,
  SynchronousDataTransformerInfo,
  getFieldMatcher,
  DataTransformContext,
  FieldMatcher,
} from '@grafana/data';
import { getMatcherConfig } from '@grafana/data/src/transformations/transformers/filterByName';
import { noopTransformer } from '@grafana/data/src/transformations/transformers/noop';

import { partition } from './partition';

export interface FrameNamingOptions {
  /** when true, the frame name is copied unmodified, and discriminator fields' names+values become field labels in new frames */
  asLabels?: boolean;

  /** opts below are used only when asLabels: false */

  /** whether to append to existing frame name, false -> replace */
  append?: boolean; // false
  /** whether to include discriminator field names, e.g. true -> Region=Europe Profession=Chef, false -> 'Europe Chef'  */
  withNames?: boolean; // false
  /** name/value separator, e.g. '=' in 'Region=Europe' */
  separator1?: string;
  /** name/value pair separator, e.g. ' ' in 'Region=Europe Profession=Chef' */
  separator2?: string;
}

const defaultFrameNameOptions: FrameNamingOptions = {
  asLabels: true,

  append: false,
  withNames: false,
  separator1: '=',
  separator2: ' ',
};

export interface PartitionByValuesTransformerOptions {
  /** field names whose values should be used as discriminator keys (typically enum fields) */
  fields: string[];
  /** how the split frames' names should be suffixed (ends up as field prefixes) */
  naming?: FrameNamingOptions;
  /** should the discriminator fields be kept in the output */
  keepFields?: boolean;
}

function buildFrameName(opts: FrameNamingOptions, names: string[], values: unknown[]): string {
  return names
    .map((name, i) => (opts.withNames ? `${name}${opts.separator1}${values[i]}` : values[i]))
    .join(opts.separator2);
}

function buildFieldLabels(names: string[], values: unknown[]) {
  const labels: Record<string, string> = {};

  names.forEach((name, i) => {
    labels[name] = String(values[i]);
  });

  return labels;
}

export const partitionByValuesTransformer: SynchronousDataTransformerInfo<PartitionByValuesTransformerOptions> = {
  id: DataTransformerID.partitionByValues,
  name: 'Partition by values',
  description: `Splits a one-frame dataset into multiple series discriminated by unique/enum values in one or more fields.`,
  defaultOptions: {
    keepFields: false,
  },

  operator: (options, ctx) => (source) =>
    source.pipe(map((data) => partitionByValuesTransformer.transformer(options, ctx)(data))),

  transformer: (options: PartitionByValuesTransformerOptions, ctx: DataTransformContext) => {
    const matcherConfig = getMatcherConfig({ names: options.fields });

    if (!matcherConfig) {
      return noopTransformer.transformer({}, ctx);
    }

    const matcher = getFieldMatcher(matcherConfig);

    return (data: DataFrame[]) => {
      if (!data.length) {
        return data;
      }
      // error if > 1 frame?
      return partitionByValues(data[0], matcher, options);
    };
  },
};

// Split a single frame dataset into multiple frames based on values in a set of fields
export function partitionByValues(
  frame: DataFrame,
  matcher: FieldMatcher,
  options?: PartitionByValuesTransformerOptions
): DataFrame[] {
  const keyFields = frame.fields.filter((f) => matcher(f, frame, [frame]))!;

  if (!keyFields.length) {
    return [frame];
  }

  const keyFieldsVals = keyFields.map((f) => f.values);
  const names = keyFields.map((f) => f.name);

  const frameNameOpts = {
    ...defaultFrameNameOptions,
    ...options?.naming,
  };

  return partition(keyFieldsVals).map((idxs: number[]) => {
    let frameName = frame.name;
    let fieldLabels = {};

    if (frameNameOpts.asLabels) {
      fieldLabels = buildFieldLabels(
        names,
        keyFields.map((f, i) => keyFieldsVals[i][idxs[0]])
      );
    } else {
      let name = buildFrameName(
        frameNameOpts,
        names,
        keyFields.map((f, i) => keyFieldsVals[i][idxs[0]])
      );

      if (frameNameOpts?.append && frame.name) {
        name = `${frame.name} ${name}`;
      }

      frameName = name;
    }

    let filteredFields = frame.fields;

    if (!options?.keepFields) {
      const keyFieldNames = new Set(names);
      filteredFields = frame.fields.filter((field) => !keyFieldNames.has(field.name));
    }

    return {
      name: frameName,
      meta: frame.meta,
      length: idxs.length,
      fields: filteredFields.map((f) => {
        const vals = f.values;
        const vals2 = Array(idxs.length);

        for (let i = 0; i < idxs.length; i++) {
          vals2[i] = vals[idxs[i]];
        }

        return {
          name: f.name,
          type: f.type,
          config: f.config,
          labels: {
            ...f.labels,
            ...fieldLabels,
          },
          values: vals2,
        };
      }),
    };
  });
}
