import { DataFrame, DataTransformerInfo, FieldType, Field } from '../../types';
import { DataTransformerID } from './ids';
import { ArrayVector } from '../../vector';
import { mergeTransformer } from './merge';

export interface LabelsToFieldsOptions {}

export const labelsToFieldsTransformer: DataTransformerInfo<LabelsToFieldsOptions> = {
  id: DataTransformerID.labelsToFields,
  name: 'Labels to fields',
  description: 'Groups series by time and return labels as columns',
  defaultOptions: {},
  transformer: options => (data: DataFrame[]) => {
    const result: DataFrame[] = [];

    for (const frame of data) {
      const newFields: Field[] = [];

      for (const field of frame.fields) {
        if (field.labels) {
          for (const labelName of Object.keys(field.labels)) {
            const values = new Array(frame.length).fill(field.labels[labelName]);
            newFields.push({
              name: labelName,
              type: FieldType.string,
              values: new ArrayVector(values),
              config: {},
            });
          }
          const newField = { ...field };
          delete newField.labels;
          delete newField.config.displayName;
          newFields.push(newField);
        } else {
          newFields.push(field);
        }
      }

      result.push({
        fields: newFields,
        length: frame.length,
      });
    }

    return mergeTransformer.transformer({})(result);
  },
};
