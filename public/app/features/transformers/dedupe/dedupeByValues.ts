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

export interface DedupeByValuesTransformerOptions {
  /** field names whose values should be used as discriminator keys (typically enum fields) */
  fields: string[];
}

export const dedupeByValuesTransformer: SynchronousDataTransformerInfo<DedupeByValuesTransformerOptions> = {
  id: DataTransformerID.dedupeByValues,
  name: 'Dedupe by values',
  description: `Filters a one-frame dataset to return unique combinations of values`,
  defaultOptions: {},

  operator: (options, ctx) => (source) =>
    source.pipe(map((data) => dedupeByValuesTransformer.transformer(options, ctx)(data))),

  transformer: (options: DedupeByValuesTransformerOptions, ctx: DataTransformContext) => {
    const matcherConfig = getMatcherConfig(ctx, { names: options.fields });

    if (!matcherConfig) {
      return noopTransformer.transformer({}, ctx);
    }

    const matcher = getFieldMatcher(matcherConfig);

    return (data: DataFrame[]) => {
      if (!data.length) {
        return data;
      }
      // error if > 1 frame?
      console.time('dedupeByValues');
      const result = dedupeByValues(data[0], matcher, options);
      console.timeEnd('dedupeByValues');
      return result;
    };
  },
};

// Split a single frame dataset into multiple frames based on values in a set of fields
export function dedupeByValues(
  frame: DataFrame,
  matcher: FieldMatcher,
  options?: DedupeByValuesTransformerOptions
): DataFrame[] {
  const keyFields = frame.fields.filter((f) => matcher(f, frame, [frame]))!;

  if (!keyFields.length) {
    return [frame];
  }

  const indicies: number[] = [];
  keyFields.forEach((f) => {
    const valueIndexMap = new Map<string, number>();
    f.values.forEach((v) => {
      if (v !== undefined && !valueIndexMap.has(v) && indicies.indexOf(f.values.indexOf(v)) === -1) {
        valueIndexMap.set(v, f.values.indexOf(v));
        indicies.push(f.values.indexOf(v));
      }
    });
  });

  const outFrame: DataFrame = {
    ...frame,
    length: indicies.length,
    fields: frame.fields.map((f) => {
      return {
        ...f,
        values: f.values.filter((v, i) => indicies.indexOf(i) !== -1),
      };
    }),
  };

  return [outFrame];
}
