import { map } from 'rxjs/operators';

import { DataFrame, Field, FieldType, SynchronousDataTransformerInfo } from '../../types';
import { DataTransformerID } from './ids';
import { ArrayVector } from '../../vector';

export interface LabelsToFieldsOptions {
  /*
   * If set this will use this label's value as the value field name.
   */
  valueLabel?: string;
}

export const labelsToFieldsTransformer: SynchronousDataTransformerInfo<LabelsToFieldsOptions> = {
  id: DataTransformerID.labelsToFields,
  name: 'Labels to fields',
  description: 'Extract time series labels to fields (columns)',
  defaultOptions: {},

  operator: (options) => (source) => source.pipe(map((data) => labelsToFieldsTransformer.transformer(options)(data))),

  transformer: (options: LabelsToFieldsOptions) => (data: DataFrame[]) => {
    const result: DataFrame[] = [];

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
          // if we should use this label as the value field name store it and skip adding this as a separate field
          if (options.valueLabel === labelName) {
            sansLabels.name = field.labels[labelName];
            continue;
          }

          const uniqueValues = (uniqueLabels[labelName] ||= new Set());
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
        fields: newFields,
        length: frame.length,
      });
    }

    return result;
  },
};
