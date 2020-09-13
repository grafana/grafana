// Libraries
import { isArray, isBoolean, isNumber, isString } from 'lodash';

// Types
import {
  DataFrame,
  Field,
  FieldConfig,
  TimeSeries,
  FieldType,
  TableData,
  Column,
  GraphSeriesXY,
  TimeSeriesValue,
  FieldDTO,
  DataFrameDTO,
  TIME_SERIES_VALUE_FIELD_NAME,
  TIME_SERIES_TIME_FIELD_NAME,
} from '../types/index';
import { isDateTime } from '../datetime/moment_wrapper';
import { ArrayVector } from '../vector/ArrayVector';
import { MutableDataFrame } from './MutableDataFrame';
import { SortedVector } from '../vector/SortedVector';
import { ArrayDataFrame } from './ArrayDataFrame';
import { getFieldDisplayName } from '../field/fieldState';
import { fieldIndexComparer } from '../field/fieldComparers';

function convertTableToDataFrame(table: TableData): DataFrame {
  const fields = table.columns.map(c => {
    // TODO: should be Column but type does not exists there so not sure whats up here.
    const { text, type, ...disp } = c as any;
    return {
      name: text, // rename 'text' to the 'name' field
      config: (disp || {}) as FieldConfig,
      values: new ArrayVector(),
      type: type && Object.values(FieldType).includes(type as FieldType) ? (type as FieldType) : FieldType.other,
    };
  });

  if (!isArray(table.rows)) {
    throw new Error(`Expected table rows to be array, got ${typeof table.rows}.`);
  }

  for (const row of table.rows) {
    for (let i = 0; i < fields.length; i++) {
      fields[i].values.buffer.push(row[i]);
    }
  }

  for (const f of fields) {
    if (f.type === FieldType.other) {
      const t = guessFieldTypeForField(f);
      if (t) {
        f.type = t;
      }
    }
  }

  return {
    fields,
    refId: table.refId,
    meta: table.meta,
    name: table.name,
    length: table.rows.length,
  };
}

function convertTimeSeriesToDataFrame(timeSeries: TimeSeries): DataFrame {
  const times: number[] = [];
  const values: TimeSeriesValue[] = [];

  // Sometimes the points are sent as datapoints
  const points = timeSeries.datapoints || (timeSeries as any).points;
  for (const point of points) {
    values.push(point[0]);
    times.push(point[1] as number);
  }

  const fields = [
    {
      name: TIME_SERIES_TIME_FIELD_NAME,
      type: FieldType.time,
      config: {},
      values: new ArrayVector<number>(times),
    },
    {
      name: TIME_SERIES_VALUE_FIELD_NAME,
      type: FieldType.number,
      config: {
        unit: timeSeries.unit,
      },
      values: new ArrayVector<TimeSeriesValue>(values),
      labels: timeSeries.tags,
    },
  ];

  if (timeSeries.title) {
    (fields[1].config as FieldConfig).displayNameFromDS = timeSeries.title;
  }

  return {
    name: timeSeries.target || (timeSeries as any).name,
    refId: timeSeries.refId,
    meta: timeSeries.meta,
    fields,
    length: values.length,
  };
}

/**
 * This is added temporarily while we convert the LogsModel
 * to DataFrame.  See: https://github.com/grafana/grafana/issues/18528
 */
function convertGraphSeriesToDataFrame(graphSeries: GraphSeriesXY): DataFrame {
  const x = new ArrayVector();
  const y = new ArrayVector();

  for (let i = 0; i < graphSeries.data.length; i++) {
    const row = graphSeries.data[i];
    x.buffer.push(row[1]);
    y.buffer.push(row[0]);
  }

  return {
    name: graphSeries.label,
    fields: [
      {
        name: graphSeries.label || TIME_SERIES_VALUE_FIELD_NAME,
        type: FieldType.number,
        config: {},
        values: x,
      },
      {
        name: TIME_SERIES_TIME_FIELD_NAME,
        type: FieldType.time,
        config: {
          unit: 'dateTimeAsIso',
        },
        values: y,
      },
    ],
    length: x.buffer.length,
  };
}

function convertJSONDocumentDataToDataFrame(timeSeries: TimeSeries): DataFrame {
  const fields = [
    {
      name: timeSeries.target,
      type: FieldType.other,
      labels: timeSeries.tags,
      config: {
        unit: timeSeries.unit,
        filterable: (timeSeries as any).filterable,
      },
      values: new ArrayVector(),
    },
  ];

  for (const point of timeSeries.datapoints) {
    fields[0].values.buffer.push(point);
  }

  return {
    name: timeSeries.target,
    refId: timeSeries.target,
    meta: { json: true },
    fields,
    length: timeSeries.datapoints.length,
  };
}

// PapaParse Dynamic Typing regex:
// https://github.com/mholt/PapaParse/blob/master/papaparse.js#L998
const NUMBER = /^\s*(-?(\d*\.?\d+|\d+\.?\d*)(e[-+]?\d+)?|NAN)\s*$/i;

/**
 * Given a name and value, this will pick a reasonable field type
 */
export function guessFieldTypeFromNameAndValue(name: string, v: any): FieldType {
  if (name) {
    name = name.toLowerCase();
    if (name === 'date' || name === 'time') {
      return FieldType.time;
    }
  }
  return guessFieldTypeFromValue(v);
}

/**
 * Given a value this will guess the best column type
 *
 * TODO: better Date/Time support!  Look for standard date strings?
 */
export function guessFieldTypeFromValue(v: any): FieldType {
  if (v instanceof Date || isDateTime(v)) {
    return FieldType.time;
  }

  if (isNumber(v)) {
    return FieldType.number;
  }

  if (isString(v)) {
    if (NUMBER.test(v)) {
      return FieldType.number;
    }

    if (v === 'true' || v === 'TRUE' || v === 'True' || v === 'false' || v === 'FALSE' || v === 'False') {
      return FieldType.boolean;
    }

    return FieldType.string;
  }

  if (isBoolean(v)) {
    return FieldType.boolean;
  }

  return FieldType.other;
}

/**
 * Looks at the data to guess the column type.  This ignores any existing setting
 */
export function guessFieldTypeForField(field: Field): FieldType | undefined {
  // 1. Use the column name to guess
  if (field.name) {
    const name = field.name.toLowerCase();
    if (name === 'date' || name === 'time') {
      return FieldType.time;
    }
  }

  // 2. Check the first non-null value
  for (let i = 0; i < field.values.length; i++) {
    const v = field.values.get(i);
    if (v !== null) {
      return guessFieldTypeFromValue(v);
    }
  }

  // Could not find anything
  return undefined;
}

/**
 * @returns A copy of the series with the best guess for each field type.
 * If the series already has field types defined, they will be used, unless `guessDefined` is true.
 * @param series The DataFrame whose field's types should be guessed
 * @param guessDefined Whether to guess types of fields with already defined types
 */
export const guessFieldTypes = (series: DataFrame, guessDefined = false): DataFrame => {
  for (const field of series.fields) {
    if (!field.type || field.type === FieldType.other || guessDefined) {
      // Something is missing a type, return a modified copy
      return {
        ...series,
        fields: series.fields.map(field => {
          if (field.type && field.type !== FieldType.other && !guessDefined) {
            return field;
          }
          // Calculate a reasonable schema value
          return {
            ...field,
            type: guessFieldTypeForField(field) || FieldType.other,
          };
        }),
      };
    }
  }
  // No changes necessary
  return series;
};

export const isTableData = (data: any): data is DataFrame => data && data.hasOwnProperty('columns');

export const isDataFrame = (data: any): data is DataFrame => data && data.hasOwnProperty('fields');

/**
 * Inspect any object and return the results as a DataFrame
 */
export function toDataFrame(data: any): DataFrame {
  if ('fields' in data) {
    // DataFrameDTO does not have length
    if ('length' in data) {
      return data as DataFrame;
    }

    // This will convert the array values into Vectors
    return new MutableDataFrame(data as DataFrameDTO);
  }

  // Handle legacy docs/json type
  if (data.hasOwnProperty('type') && data.type === 'docs') {
    return convertJSONDocumentDataToDataFrame(data);
  }

  if (data.hasOwnProperty('datapoints') || data.hasOwnProperty('points')) {
    return convertTimeSeriesToDataFrame(data);
  }

  if (data.hasOwnProperty('data')) {
    return convertGraphSeriesToDataFrame(data);
  }

  if (data.hasOwnProperty('columns')) {
    return convertTableToDataFrame(data);
  }

  if (Array.isArray(data)) {
    return new ArrayDataFrame(data);
  }

  console.warn('Can not convert', data);
  throw new Error('Unsupported data format');
}

export const toLegacyResponseData = (frame: DataFrame): TimeSeries | TableData => {
  const { fields } = frame;

  const rowCount = frame.length;
  const rows: any[][] = [];

  if (fields.length === 2) {
    const { timeField, timeIndex } = getTimeField(frame);
    if (timeField) {
      const valueIndex = timeIndex === 0 ? 1 : 0;
      const valueField = fields[valueIndex];
      const timeField = fields[timeIndex!];

      // Make sure it is [value,time]
      for (let i = 0; i < rowCount; i++) {
        rows.push([
          valueField.values.get(i), // value
          timeField.values.get(i), // time
        ]);
      }

      return {
        alias: frame.name,
        target: getFieldDisplayName(valueField, frame),
        datapoints: rows,
        unit: fields[0].config ? fields[0].config.unit : undefined,
        refId: frame.refId,
        meta: frame.meta,
      } as TimeSeries;
    }
  }

  for (let i = 0; i < rowCount; i++) {
    const row: any[] = [];
    for (let j = 0; j < fields.length; j++) {
      row.push(fields[j].values.get(i));
    }
    rows.push(row);
  }

  if (frame.meta && frame.meta.json) {
    return {
      alias: fields[0].name || frame.name,
      target: fields[0].name || frame.name,
      datapoints: fields[0].values.toArray(),
      filterable: fields[0].config ? fields[0].config.filterable : undefined,
      type: 'docs',
    } as TimeSeries;
  }

  return {
    columns: fields.map(f => {
      const { name, config } = f;
      if (config) {
        // keep unit etc
        const { ...column } = config;
        (column as Column).text = name;
        return column as Column;
      }
      return { text: name };
    }),
    type: 'table',
    refId: frame.refId,
    meta: frame.meta,
    rows,
  };
};

export function sortDataFrame(data: DataFrame, sortIndex?: number, reverse = false): DataFrame {
  const field = data.fields[sortIndex!];
  if (!field) {
    return data;
  }

  // Natural order
  const index: number[] = [];
  for (let i = 0; i < data.length; i++) {
    index.push(i);
  }

  const fieldComparer = fieldIndexComparer(field, reverse);
  index.sort(fieldComparer);

  return {
    ...data,
    fields: data.fields.map(f => {
      return {
        ...f,
        values: new SortedVector(f.values, index),
      };
    }),
  };
}

/**
 * Returns a copy with all values reversed
 */
export function reverseDataFrame(data: DataFrame): DataFrame {
  return {
    ...data,
    fields: data.fields.map(f => {
      const copy = [...f.values.toArray()];
      copy.reverse();
      return {
        ...f,
        values: new ArrayVector(copy),
      };
    }),
  };
}

/**
 * Wrapper to get an array from each field value
 */
export function getDataFrameRow(data: DataFrame, row: number): any[] {
  const values: any[] = [];
  for (const field of data.fields) {
    values.push(field.values.get(row));
  }
  return values;
}

/**
 * Returns a copy that does not include functions
 */
export function toDataFrameDTO(data: DataFrame): DataFrameDTO {
  const fields: FieldDTO[] = data.fields.map(f => {
    let values = f.values.toArray();
    if (!Array.isArray(values)) {
      // Apache arrow will pack objects into typed arrays
      // Float64Array, etc
      // TODO: Float64Array could be used directly
      values = [];
      for (let i = 0; i < f.values.length; i++) {
        values.push(f.values.get(i));
      }
    }

    return {
      name: f.name,
      type: f.type,
      config: f.config,
      values,
      labels: f.labels,
    };
  });

  return {
    fields,
    refId: data.refId,
    meta: data.meta,
    name: data.name,
  };
}

export const getTimeField = (series: DataFrame): { timeField?: Field; timeIndex?: number } => {
  for (let i = 0; i < series.fields.length; i++) {
    if (series.fields[i].type === FieldType.time) {
      return {
        timeField: series.fields[i],
        timeIndex: i,
      };
    }
  }
  return {};
};
