import { map } from 'rxjs/operators';

import { DataFrame, DataTransformerInfo, Field } from '../../types';
import { DataTransformerID } from './ids';
import { MutableDataFrame } from '../../dataframe';
import { ArrayVector } from '../../vector';
import { getFieldDisplayName } from '../../field/fieldState';

export interface SeriesToColumnsOptions {
  byField?: string;
}

const DEFAULT_KEY_FIELD = 'Time';

export const seriesToColumnsTransformer: DataTransformerInfo<SeriesToColumnsOptions> = {
  id: DataTransformerID.seriesToColumns,
  name: 'Series as columns',
  description: 'Groups series by field and returns values as columns',
  defaultOptions: {
    byField: DEFAULT_KEY_FIELD,
  },
  operator: options => source =>
    source.pipe(
      map(data => {
        const keyFieldMatch = options.byField || DEFAULT_KEY_FIELD;
        const allFields: FieldsToProcess[] = [];

        for (let frameIndex = 0; frameIndex < data.length; frameIndex++) {
          const frame = data[frameIndex];
          const keyField = findKeyField(frame, keyFieldMatch);

          if (!keyField) {
            continue;
          }

          for (let fieldIndex = 0; fieldIndex < frame.fields.length; fieldIndex++) {
            const sourceField = frame.fields[fieldIndex];

            if (sourceField === keyField) {
              continue;
            }

            let labels = sourceField.labels ?? {};

            if (frame.name) {
              labels = { ...labels, name: frame.name };
            }

            allFields.push({
              keyField,
              sourceField,
              newField: {
                ...sourceField,
                state: null,
                values: new ArrayVector([]),
                labels,
              },
            });
          }
        }

        // if no key fields or more than one value field
        if (allFields.length <= 1) {
          return data;
        }

        const resultFrame = new MutableDataFrame();

        resultFrame.addField({
          ...allFields[0].keyField,
          values: new ArrayVector([]),
        });

        for (const item of allFields) {
          item.newField = resultFrame.addField(item.newField);
        }

        const keyFieldTitle = getFieldDisplayName(resultFrame.fields[0], resultFrame);
        const byKeyField: { [key: string]: { [key: string]: any } } = {};

        /*
    this loop creates a dictionary object that groups the key fields values
    {
      "key field first value as string" : {
        "key field name": key field first value,
        "other series name": other series value
        "other series n name": other series n value
      },
      "key field n value as string" : {
        "key field name": key field n value,
        "other series name": other series value
        "other series n name": other series n value
      }
    }
    */

        for (let fieldIndex = 0; fieldIndex < allFields.length; fieldIndex++) {
          const { sourceField, keyField, newField } = allFields[fieldIndex];
          const newFieldTitle = getFieldDisplayName(newField, resultFrame);

          for (let valueIndex = 0; valueIndex < sourceField.values.length; valueIndex++) {
            const value = sourceField.values.get(valueIndex);
            const keyValue = keyField.values.get(valueIndex);

            if (!byKeyField[keyValue]) {
              byKeyField[keyValue] = { [newFieldTitle]: value, [keyFieldTitle]: keyValue };
            } else {
              byKeyField[keyValue][newFieldTitle] = value;
            }
          }
        }

        const keyValueStrings = Object.keys(byKeyField);
        for (let rowIndex = 0; rowIndex < keyValueStrings.length; rowIndex++) {
          const keyValueAsString = keyValueStrings[rowIndex];

          for (let fieldIndex = 0; fieldIndex < resultFrame.fields.length; fieldIndex++) {
            const field = resultFrame.fields[fieldIndex];
            const otherColumnName = getFieldDisplayName(field, resultFrame);
            const value = byKeyField[keyValueAsString][otherColumnName] ?? null;
            field.values.add(value);
          }
        }

        return [resultFrame];
      })
    ),
};

function findKeyField(frame: DataFrame, matchTitle: string): Field | null {
  for (let fieldIndex = 0; fieldIndex < frame.fields.length; fieldIndex++) {
    const field = frame.fields[fieldIndex];

    if (matchTitle === getFieldDisplayName(field)) {
      return field;
    }
  }

  return null;
}

interface FieldsToProcess {
  newField: Field;
  sourceField: Field;
  keyField: Field;
}
