import { DataFrame, DataTransformerInfo, FieldType } from '../../types';
import { DataTransformerID } from './ids';
import { MutableDataFrame } from '../../dataframe';
import { ArrayVector } from '../../vector';
import { filterFieldsTransformer } from './filter';
import { FieldMatcherID } from '..';

export interface LabelsAsColumnsOptions {}
type MapItem = { type: FieldType; values: Record<string, any>; isValue: boolean };
type Map = Record<string, MapItem>;

export const labelsAsColumnsTransformer: DataTransformerInfo<LabelsAsColumnsOptions> = {
  id: DataTransformerID.labelsAsColumns,
  name: 'Labels as columns',
  description: 'Groups series by time and return labels as columns',
  defaultOptions: {},
  transformer: options => (data: DataFrame[]) => {
    const framesWithTimeField = filterFieldsTransformer.transformer({ include: { id: FieldMatcherID.time } })(data);
    if (!framesWithTimeField.length || !framesWithTimeField[0].fields.length) {
      return data;
    }

    const framesWithoutTimeField = filterFieldsTransformer.transformer({ exclude: { id: FieldMatcherID.time } })(data);
    if (!framesWithoutTimeField.length || !framesWithoutTimeField[0].fields.length) {
      return data;
    }

    const columnsMap = createColumnsMap(framesWithTimeField, framesWithoutTimeField);
    const processed = createFields(columnsMap);

    const timeColumn = columnsMap[processed.fields[0].name];
    const timeValueStrings = Object.keys(timeColumn.values);

    for (const timeValueString of timeValueStrings) {
      for (const field of processed.fields) {
        const value = columnsMap[field.name].values[timeValueString] ?? null;
        field.values.add(value);
      }
    }

    return [processed];
  },
};

function createColumnsMap(framesWithTimeField: DataFrame[], framesWithoutTimeField: DataFrame[]) {
  const map: Map = {};

  for (let frameIndex = 0; frameIndex < framesWithTimeField.length; frameIndex++) {
    const timeFrame = framesWithTimeField[frameIndex];
    const otherFrame = framesWithoutTimeField[frameIndex];
    const timeField = timeFrame.fields[0];

    if (!map[timeField.name]) {
      map[timeField.name] = { type: timeField.type, values: {}, isValue: false };
    }

    for (let valueIndex = 0; valueIndex < timeFrame.length; valueIndex++) {
      const timeFieldValue = timeField.values.get(valueIndex);
      map[timeField.name].values[timeFieldValue] = timeFieldValue;

      for (const field of otherFrame.fields) {
        if (field.labels) {
          const labels = Object.keys(field.labels);
          for (const label of labels) {
            if (!map[label]) {
              map[label] = { type: FieldType.string, values: {}, isValue: false };
            }
            map[label].values[timeFieldValue] = field.labels[label];
          }
        }

        const otherFieldValue = field.values.get(valueIndex);
        if (!map[field.name]) {
          map[field.name] = { type: field.type, values: {}, isValue: true };
        }

        map[field.name].values[timeFieldValue] = otherFieldValue;
      }
    }
  }

  return map;
}

function createFields(columnsMap: Map) {
  const columns = Object.keys(columnsMap);
  const processed = new MutableDataFrame();
  const valueColumns: string[] = [];

  for (const column of columns) {
    const columnItem = columnsMap[column];
    if (columnItem.isValue) {
      valueColumns.push(column);
      continue;
    }
    processed.addField({ type: columnItem.type, values: new ArrayVector(), name: column });
  }

  for (const column of valueColumns) {
    const columnItem = columnsMap[column];
    processed.addField({ type: columnItem.type, values: new ArrayVector(), name: column });
  }

  return processed;
}
