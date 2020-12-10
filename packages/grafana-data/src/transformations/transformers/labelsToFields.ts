import { map } from 'rxjs/operators';

import { DataFrame, DataTransformerInfo, Field, FieldType } from '../../types';
import { DataTransformerID } from './ids';
import { ArrayVector } from '../../vector';
import { mergeTransformer } from './merge';

export interface LabelsToFieldsOptions {
  /*
   * If set this will use this label's value as the value field name.
   */
  valueLabel?: string;
}

export const labelsToFieldsTransformer: DataTransformerInfo<LabelsToFieldsOptions> = {
  id: DataTransformerID.labelsToFields,
  name: 'Labels to fields',
  description: 'Extract time series labels to fields (columns)',
  defaultOptions: {},
  operator: options => source =>
    source.pipe(
      map(data => {
        const result: DataFrame[] = [];

        for (const frame of data) {
          const newFields: Field[] = [];

          for (const field of frame.fields) {
            if (!field.labels) {
              newFields.push(field);
              continue;
            }

            let name = field.name;

            for (const labelName of Object.keys(field.labels)) {
              // if we should use this label as the value field name store it and skip adding this as a separate field
              if (options.valueLabel === labelName) {
                name = field.labels[labelName];
                continue;
              }

              const values = new Array(frame.length).fill(field.labels[labelName]);
              newFields.push({
                name: labelName,
                type: FieldType.string,
                values: new ArrayVector(values),
                config: {},
              });
            }

            // add the value field but clear out any labels or displayName
            newFields.push({
              ...field,
              name,
              config: {
                ...field.config,
                // we need to clear thes for this transform as these can contain label names that we no longer want
                displayName: undefined,
                displayNameFromDS: undefined,
              },
              labels: undefined,
            });
          }

          result.push({
            fields: newFields,
            length: frame.length,
          });
        }

        return result;
      }),
      mergeTransformer.operator({})
    ),
};
