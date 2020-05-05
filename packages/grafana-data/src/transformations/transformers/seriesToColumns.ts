import { DataFrame, DataTransformerInfo, Field } from '../../types';
import { DataTransformerID } from './ids';
import { MutableDataFrame } from '../../dataframe';
import { ArrayVector } from '../../vector';
import { getFieldState } from '../../field/fieldState';

export interface SeriesToColumnsOptions {
  byField?: string;
}

export const seriesToColumnsTransformer: DataTransformerInfo<SeriesToColumnsOptions> = {
  id: DataTransformerID.seriesToColumns,
  name: 'Series as columns',
  description: 'Groups series by field and returns values as columns',
  defaultOptions: {
    byField: 'Time',
  },
  transformer: options => (data: DataFrame[]) => {
    const keyFields: Field[] = [];
    const valueFields: Array<{ newField: Field; sourceField: Field }> = [];

    for (let frameIndex = 0; frameIndex < data.length; frameIndex++) {
      const frame = data[frameIndex];

      for (let fieldIndex = 0; fieldIndex < frame.fields.length; fieldIndex++) {
        const field = frame.fields[fieldIndex];

        if (options.byField === getFieldState(field).title) {
          keyFields.push(field);
          continue;
        }

        let labels = field.labels ?? {};

        if (frame.name) {
          labels = { ...labels, name: frame.name };
        }

        valueFields.push({
          sourceField: field,
          newField: { ...field, values: new ArrayVector([]), labels },
        });
      }
    }

    // if no key fields or more than one value field
    if (keyFields.length === 0 || valueFields.length <= 1) {
      return data;
    }

    const resultFrame = new MutableDataFrame();

    resultFrame.addField({
      ...keyFields[0],
      values: new ArrayVector([]),
    });

    for (const item of valueFields) {
      resultFrame.addField(item.newField);
    }

    const byKeyField: { [key: string]: { [key: string]: any } } = {};
    // this loop creates a dictionary object that groups the key fields values
    /*
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
    for (let seriesIndex = 0; seriesIndex < keyFields.length; seriesIndex++) {
      const keyField = keyFields[seriesIndex];
      const keyColumnName = getFieldState(keyField, resultFrame).title;
      const keyValues = keyField.values;

      for (let valueIndex = 0; valueIndex < keyValues.length; valueIndex++) {
        const keyValue = keyValues.get(valueIndex);
        const keyValueAsString = keyValue.toString();

        if (!byKeyField[keyValueAsString]) {
          byKeyField[keyValueAsString] = { [keyColumnName]: keyValue };
        }

        for (let otherIndex = 0; otherIndex < valueFields.length; otherIndex++) {
          const otherField = valueFields[otherIndex];
          const otherColumnName = getFieldState(otherField.newField, resultFrame).title;
          const otherValue = otherField.sourceField.values.get(valueIndex);

          if (!byKeyField[keyValueAsString][otherColumnName]) {
            byKeyField[keyValueAsString] = { ...byKeyField[keyValueAsString], [otherColumnName]: otherValue };
          }
        }
      }
    }

    const keyValueStrings = Object.keys(byKeyField);
    for (let rowIndex = 0; rowIndex < keyValueStrings.length; rowIndex++) {
      const keyValueAsString = keyValueStrings[rowIndex];

      for (let fieldIndex = 0; fieldIndex < resultFrame.fields.length; fieldIndex++) {
        const field = resultFrame.fields[fieldIndex];
        const otherColumnName = getFieldState(field, resultFrame).title;
        const value = byKeyField[keyValueAsString][otherColumnName] ?? null;
        field.values.add(value);
      }
    }

    return [resultFrame];
  },
};
