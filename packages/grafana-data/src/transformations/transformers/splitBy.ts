import { without } from 'lodash';
import { map } from 'rxjs/operators';

import { DataFrame } from '../../types/dataFrame';
import { SynchronousDataTransformerInfo } from '../../types/transformations';
import { fieldMatchers } from '../matchers';
import { FieldMatcherID } from '../matchers/ids';

import { DataTransformerID } from './ids';

export interface SplitByTransformerOptions {
  /**
   * The field on which to split the frame
   */
  field: string;
}

export const splitByTransformer: SynchronousDataTransformerInfo<SplitByTransformerOptions> = {
  id: DataTransformerID.splitBy,
  name: 'Split by',
  description: "Split a data frame into multiple frames grouped by a field's values",
  defaultOptions: {
    field: '',
  },

  operator: (options, ctx) => (source) =>
    source.pipe(map((data) => splitByTransformer.transformer(options, ctx)(data))),

  transformer: (options: SplitByTransformerOptions) => (data: DataFrame[]) => {
    if (!Array.isArray(data) || data.length !== 1) {
      return data;
    }

    const frame = data[0];

    const matches = fieldMatchers.get(FieldMatcherID.byName).get(options.field);
    const targetField = frame.fields.find(field => matches(field, frame, data));

    if (!targetField) {
      return data;
    }

    // Create dictionary of unique groups to their row indexes
    const groups: Record<any, number[]> = {};
    for (let i = 0; i < frame.length; i++) {
      (groups[targetField.values.get(i)] ??= []).push(i);
    }

    const remainingFields = without(frame.fields, targetField);

    const processed: DataFrame[] = Object.keys(groups).map(group => ({
      ...frame,
      name: group,
      length: groups[group].length,
      fields: remainingFields.map(field => ({
        name: field.name,
        type: field.type,
        config: { ...field.config },
        values: groups[group].map(ix => field.values[ix])
      }))
    }));

    return processed;
  },
};
