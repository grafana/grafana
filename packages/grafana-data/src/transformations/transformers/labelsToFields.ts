import { map } from 'rxjs/operators';

import { getFieldDisplayName } from '../..';
import { DataFrame, Field, FieldType, SynchronousDataTransformerInfo } from '../../types';
import { ArrayVector } from '../../vector';

import { DataTransformerID } from './ids';

export enum LabelsToFieldsMode {
  Columns = 'columns', // default mode
  Rows = 'rows',
}
export interface LabelsToFieldsOptions {
  mode?: LabelsToFieldsMode;

  /** When empty, this will keep all labels, otherise it will keep only labels matching the value */
  keepLabels?: string[];

  /**
   * When in column mode and if set this will use this label's value as the value field name.
   */
  valueLabel?: string;
}

export const labelsToFieldsTransformer: SynchronousDataTransformerInfo<LabelsToFieldsOptions> = {
  id: DataTransformerID.labelsToFields,
  name: 'Labels to fields',
  description: 'Extract time series labels to fields (columns or rows)',
  defaultOptions: {},

  operator: (options, ctx) => (source) =>
    source.pipe(map((data) => labelsToFieldsTransformer.transformer(options, ctx)(data))),

  transformer: (options: LabelsToFieldsOptions) => (data: DataFrame[]) => {
    // Show each label as a field row
    if (options.mode === LabelsToFieldsMode.Rows) {
      return convertLabelsToRows(data, options.keepLabels);
    }

    const result: DataFrame[] = [];
    const keepLabels = options.keepLabels?.length ? new Set(options.keepLabels) : undefined;

    for (const frame of data) {
      const newFields: Field[] = [];
      const uniqueLabels: Record<string, Set<string>> = {};
      for (const field of frame.fields) {
        if (!field.labels) {
          newFields.push(field);
          continue;
        }

        const sansLabels = {
          ...field,
          config: {
            ...field.config,
            // we need to clear thes for this transform as these can contain label names that we no longer want
            displayName: undefined,
            displayNameFromDS: undefined,
          },
          labels: undefined,
        };
        newFields.push(sansLabels);

        for (const labelName of Object.keys(field.labels)) {
          if (keepLabels && !keepLabels.has(labelName)) {
            continue;
          }

          // if we should use this label as the value field name store it and skip adding this as a separate field
          if (options.valueLabel === labelName) {
            sansLabels.name = field.labels[labelName];
            continue;
          }

          const uniqueValues = uniqueLabels[labelName] ?? (uniqueLabels[labelName] = new Set()); // (Safari 13.1 lacks ??= support)
          uniqueValues.add(field.labels[labelName]);
        }
      }

      for (const name in uniqueLabels) {
        for (const value of uniqueLabels[name]) {
          const values = new Array(frame.length).fill(value);
          newFields.push({
            name: name,
            type: FieldType.string,
            values: new ArrayVector(values),
            config: {},
          });
        }
      }

      result.push({
        ...frame,
        fields: newFields,
        length: frame.length,
      });
    }

    return result;
  },
};

function convertLabelsToRows(data: DataFrame[], keepLabels?: string[]): DataFrame[] {
  const result: DataFrame[] = [];
  for (const frame of data) {
    for (const field of frame.fields) {
      if (field.labels) {
        const keys: string[] = [];
        const vals: string[] = [];
        if (keepLabels) {
          for (const key of keepLabels) {
            keys.push(key);
            vals.push(field.labels[key]);
          }
        } else {
          for (const [key, val] of Object.entries(field.labels)) {
            keys.push(key);
            vals.push(val);
          }
        }
        if (vals.length) {
          result.push({
            ...frame,
            name: getFieldDisplayName(field, frame, data),
            fields: [
              { name: 'label', type: FieldType.string, config: {}, values: new ArrayVector(keys) },
              { name: 'value', type: FieldType.string, config: {}, values: new ArrayVector(vals) },
            ],
            length: vals.length,
          });
        }
      }
    }
  }
  return result;
}
