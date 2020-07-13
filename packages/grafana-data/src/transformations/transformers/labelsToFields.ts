import { DataFrame, DataTransformerInfo, FieldType, Field } from '../../types';
import { DataTransformerID } from './ids';
import { ArrayVector } from '../../vector';
import { filterFieldsTransformer } from './filter';
import { FieldMatcherID } from '..';
import { MutableField } from '../../dataframe';

export interface LabelsToFieldsOptions {}
type MapItem = { type: FieldType; values: Record<string, any>; isValue: boolean };
type SeriesMapItem = Record<string, MapItem>;
type Map = Record<string, SeriesMapItem>;

export const labelsToFieldsTransformer: DataTransformerInfo<LabelsToFieldsOptions> = {
  id: DataTransformerID.labelsToFields,
  name: 'Labels to fields',
  description: 'Groups series by time and return labels as columns',
  defaultOptions: {},
  transformer: options => (data: DataFrame[]) => {
    const framesWithTimeField = filterFieldsTransformer.transformer({ include: { id: FieldMatcherID.time } })(data);
    if (!framesWithTimeField.length || !framesWithTimeField[0].fields.length) {
      return data;
    }

    // get frames with only value fields
    const framesWithoutTimeField = getFramesWithOnlyValueFields(data);
    if (!framesWithoutTimeField.length || !framesWithoutTimeField[0].fields.length) {
      return data;
    }

    const columnsMap = createColumnsMap(framesWithTimeField, framesWithoutTimeField);
    const fields = createFields(columnsMap);
    const values: Record<string, any[]> = {};

    const timeColumnItem = columnsMap[fields[0].name];
    const seriesIndexStrings = Object.keys(timeColumnItem);
    for (const seriesIndexString of seriesIndexStrings) {
      const seriesItem = timeColumnItem[seriesIndexString];
      const timeValueStrings = Object.keys(seriesItem.values);

      for (const timeValueString of timeValueStrings) {
        if (!values[timeValueString]) {
          values[timeValueString] = [];
        }
        let row = new Array(fields.length);
        for (let index = 0; index < fields.length; index++) {
          const field = fields[index];
          const valueItem = columnsMap[field.name][seriesIndexString];
          const value = valueItem ? valueItem.values[timeValueString] ?? null : null;
          row[index] = value;
        }
        values[timeValueString].push(row);
      }
    }

    const timestamps = Object.values(values);
    for (const timestamp of timestamps) {
      for (const row of timestamp) {
        for (let fieldIndex = 0; fieldIndex < fields.length; fieldIndex++) {
          fields[fieldIndex].values.add(row[fieldIndex]);
        }
      }
    }

    return [
      {
        fields,
        length: fields[0].values.length,
      },
    ];
  },
};

function getFramesWithOnlyValueFields(data: DataFrame[]): DataFrame[] {
  const processed: DataFrame[] = [];

  for (const series of data) {
    const fields: Field[] = [];

    for (let i = 0; i < series.fields.length; i++) {
      const field = series.fields[i];

      if (field.type !== FieldType.number) {
        continue;
      }

      fields.push(field);
    }

    if (!fields.length) {
      continue;
    }

    const copy = {
      ...series, // all the other properties
      fields, // but a different set of fields
    };

    processed.push(copy);
  }

  return processed;
}

function addOrAppendMapItem(args: { map: Map; series: number; column: string; type: FieldType; isValue?: boolean }) {
  const { map, column, type, series, isValue = false } = args;
  // we're using the fact that the series (number) will automatically become a string prop on the object
  const seriesMapItem: SeriesMapItem = { [series]: { type, values: {}, isValue } };
  if (!map[column]) {
    map[column] = seriesMapItem;
  }

  if (!map[column][series]) {
    map[column] = { ...map[column], ...seriesMapItem };
  }
}

// this is a naive implementation that does the job, not optimized for performance or speed
function createColumnsMap(framesWithTimeField: DataFrame[], framesWithoutTimeField: DataFrame[]) {
  const map: Map = {};

  for (let frameIndex = 0; frameIndex < framesWithTimeField.length; frameIndex++) {
    const timeFrame = framesWithTimeField[frameIndex];
    const otherFrame = framesWithoutTimeField[frameIndex];
    const timeField = timeFrame.fields[0];

    addOrAppendMapItem({ map, column: timeField.name, series: frameIndex, type: timeField.type });

    for (let valueIndex = 0; valueIndex < timeFrame.length; valueIndex++) {
      const timeFieldValue = timeField.values.get(valueIndex);
      map[timeField.name][frameIndex].values[timeFieldValue] = timeFieldValue;

      for (const field of otherFrame.fields) {
        if (field.labels) {
          const labels = Object.keys(field.labels);
          for (const label of labels) {
            addOrAppendMapItem({ map, column: label, series: frameIndex, type: FieldType.string });

            map[label][frameIndex].values[timeFieldValue] = field.labels[label];
          }
        }

        const otherFieldValue = field.values.get(valueIndex);
        addOrAppendMapItem({ map, column: field.name, series: frameIndex, type: field.type, isValue: true });

        map[field.name][frameIndex].values[timeFieldValue] = otherFieldValue;
      }
    }
  }

  return map;
}

function createFields(columnsMap: Map): MutableField[] {
  const columns = Object.keys(columnsMap);
  const fields: MutableField[] = [];
  const valueColumns: string[] = [];

  for (const column of columns) {
    const columnItem = Object.values<MapItem>(columnsMap[column])[0];
    if (columnItem.isValue) {
      valueColumns.push(column);
      continue;
    }
    fields.push({ type: columnItem.type, values: new ArrayVector(), name: column, config: {} });
  }

  for (const column of valueColumns) {
    const columnItem = Object.values<MapItem>(columnsMap[column])[0];
    fields.push({ type: columnItem.type, values: new ArrayVector(), name: column, config: {} });
  }

  return fields;
}
