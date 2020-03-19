import { DataFrame, DataTransformerInfo } from '../../types';
import { DataTransformerID } from './ids';
import { MutableDataFrame } from '../../dataframe';
import { filterFieldsByNameTransformer } from './filterByName';
import { ArrayVector } from '../../vector';

export interface JoinOptions {
  byField: string;
}

export const joinTransformer: DataTransformerInfo<JoinOptions> = {
  id: DataTransformerID.join,
  name: 'Join',
  description: 'Append values into a single DataFrame.  This uses the name as the key',
  defaultOptions: {},
  transformer: options => (data: DataFrame[]) => {
    const regex = `/^(${options.byField})$/`;
    // not sure if I should use filterFieldsByNameTransformer to get the key field
    const keyDataFrames = filterFieldsByNameTransformer.transformer({ include: regex })(data);
    if (!keyDataFrames.length || (keyDataFrames.length && keyDataFrames[0].fields.length !== 1)) {
      // for now we only parse data frames with 2 fields
      return data;
    }

    // not sure if I should use filterFieldsByNameTransformer to get the other fields
    const otherDataFrames = filterFieldsByNameTransformer.transformer({ exclude: regex })(data);
    if (!otherDataFrames.length || (otherDataFrames.length && otherDataFrames[0].fields.length !== 1)) {
      // for now we only parse data frames with 2 fields
      return data;
    }

    const processed = new MutableDataFrame();
    processed.addField({ ...keyDataFrames[0].fields[0], values: new ArrayVector([]) });
    for (const frame of otherDataFrames) {
      for (const field of frame.fields) {
        const name = frame.name ?? field.name;
        if (processed.fields.find(field => field.name === name)) {
          continue;
        }
        processed.addField({ ...field, name, values: new ArrayVector([]) });
      }
    }

    const joinedByKeyField: { [key: string]: { [key: string]: any } } = {};
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
    for (let seriesIndex = 0; seriesIndex < keyDataFrames.length; seriesIndex++) {
      const keyDataFrame = keyDataFrames[seriesIndex];
      const keyField = keyDataFrame.fields[0];
      const keyColumnName = keyField.name;
      const keyValues = keyField.values;
      const otherColumnName = keyDataFrame.name ?? seriesIndex.toString();
      for (let valueIndex = 0; valueIndex < keyValues.length; valueIndex++) {
        const keyValue = keyValues.get(valueIndex);
        const keyValueAsString = keyValue.toString();
        if (!joinedByKeyField[keyValueAsString]) {
          joinedByKeyField[keyValueAsString] = { [keyColumnName]: keyValue };
        }
        const otherDataFrame = otherDataFrames[seriesIndex];
        const otherField = otherDataFrame.fields[0];
        const otherValue = otherField.values.get(valueIndex);
        if (!joinedByKeyField[keyValueAsString][otherColumnName]) {
          joinedByKeyField[keyValueAsString] = { ...joinedByKeyField[keyValueAsString], [otherColumnName]: otherValue };
        }
      }
    }

    const keyValueStrings = Object.keys(joinedByKeyField);
    for (let rowIndex = 0; rowIndex < keyValueStrings.length; rowIndex++) {
      const keyValueAsString = keyValueStrings[rowIndex];
      for (let fieldIndex = 0; fieldIndex < processed.fields.length; fieldIndex++) {
        const field = processed.fields[fieldIndex];
        const value = joinedByKeyField[keyValueAsString][field.name] ?? null;
        field.values.add(value);
      }
    }

    return [processed];
  },
};
