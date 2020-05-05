// Libraries
import { isArray } from 'lodash';

// Types
import {
  DataFrame,
  FieldConfig,
  TimeSeries,
  FieldType,
  TableData,
  GraphSeriesXY,
  TimeSeriesValue,
  DataFrameDTO,
} from '../types/index';
import { ArrayVector } from '../vector/ArrayVector';
import { MutableDataFrame } from './MutableDataFrame';
import { ArrayDataFrame } from './ArrayDataFrame';
import { guessFieldTypeForField } from './processDataFrame';

function convertTableToDataFrame(table: TableData): DataFrame {
  const fields = table.columns.map(c => {
    const { text, ...disp } = c;
    return {
      name: text, // rename 'text' to the 'name' field
      config: (disp || {}) as FieldConfig,
      values: new ArrayVector(),
      type: FieldType.other,
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
    const t = guessFieldTypeForField(f);
    if (t) {
      f.type = t;
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
  for (const point of timeSeries.datapoints) {
    values.push(point[0]);
    times.push(point[1] as number);
  }

  const fields = [
    {
      name: 'Time',
      type: FieldType.time,
      config: {},
      values: new ArrayVector<number>(times),
    },
    {
      name: timeSeries.target || 'Value',
      type: FieldType.number,
      config: {
        unit: timeSeries.unit,
      },
      values: new ArrayVector<TimeSeriesValue>(values),
      labels: timeSeries.tags,
    },
  ];

  return {
    name: timeSeries.target,
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
        name: graphSeries.label || 'Value',
        type: FieldType.number,
        config: {},
        values: x,
      },
      {
        name: 'Time',
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

  if (data.hasOwnProperty('datapoints')) {
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
