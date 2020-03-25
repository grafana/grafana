import { DataFrame, DataTransformerInfo } from '../../types';
import { DataTransformerID } from './ids';
import { MutableDataFrame } from '../../dataframe';
import { filterFieldsByNameTransformer } from './filterByName';
import { ArrayVector } from '../../vector';

export interface SeriesToColumnsOptions {
  byField: string;
}

export const seriesToColumnsTransformer: DataTransformerInfo<SeriesToColumnsOptions> = {
  id: DataTransformerID.seriesToColumns,
  name: 'Series as Columns',
  description: 'Groups series by field and returns values as columns',
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
    const origins: string[] = [];
    for (let frameIndex = 0; frameIndex < keyDataFrames.length; frameIndex++) {
      const frame = keyDataFrames[frameIndex];
      const origin = getOrigin(frame, frameIndex);
      origins.push(origin);
    }

    processed.addField({
      ...keyDataFrames[0].fields[0],
      values: new ArrayVector([]),
      labels: { origin: origins.join('|') },
    });

    for (let frameIndex = 0; frameIndex < otherDataFrames.length; frameIndex++) {
      const frame = otherDataFrames[frameIndex];
      for (const field of frame.fields) {
        const origin = getOrigin(frame, frameIndex);
        const name = getColumnName(otherDataFrames, frameIndex, false);
        if (processed.fields.find(field => field.name === name)) {
          continue;
        }
        processed.addField({ ...field, name, values: new ArrayVector([]), labels: { origin } });
      }
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
    for (let seriesIndex = 0; seriesIndex < keyDataFrames.length; seriesIndex++) {
      const keyDataFrame = keyDataFrames[seriesIndex];
      const keyField = keyDataFrame.fields[0];
      const keyColumnName = getColumnName(keyDataFrames, seriesIndex, true);
      const keyValues = keyField.values;
      const otherColumnName = getColumnName(otherDataFrames, seriesIndex, false);
      for (let valueIndex = 0; valueIndex < keyValues.length; valueIndex++) {
        const keyValue = keyValues.get(valueIndex);
        const keyValueAsString = keyValue.toString();
        if (!byKeyField[keyValueAsString]) {
          byKeyField[keyValueAsString] = { [keyColumnName]: keyValue };
        }
        const otherDataFrame = otherDataFrames[seriesIndex];
        const otherField = otherDataFrame.fields[0];
        const otherValue = otherField.values.get(valueIndex);
        if (!byKeyField[keyValueAsString][otherColumnName]) {
          byKeyField[keyValueAsString] = { ...byKeyField[keyValueAsString], [otherColumnName]: otherValue };
        }
      }
    }

    const keyValueStrings = Object.keys(byKeyField);
    for (let rowIndex = 0; rowIndex < keyValueStrings.length; rowIndex++) {
      const keyValueAsString = keyValueStrings[rowIndex];
      for (let fieldIndex = 0; fieldIndex < processed.fields.length; fieldIndex++) {
        const field = processed.fields[fieldIndex];
        const value = byKeyField[keyValueAsString][field.name] ?? null;
        field.values.add(value);
      }
    }

    return [processed];
  },
};

const getColumnName = (frames: DataFrame[], frameIndex: number, isKeyField = false) => {
  const frame = frames[frameIndex];
  const frameName = frame.name || `${frameIndex}`;
  const fieldName = frame.fields[0].name;
  const seriesName = isKeyField ? fieldName : `${fieldName} {${frameName}}`;

  return seriesName;
};

const getOrigin = (frame: DataFrame, index: number) => {
  return frame.name || `${index}`;
};
