import { dateTime } from '../datetime/moment_wrapper';
import { DataFrameDTO, FieldType, TableData, TimeSeries } from '../types/index';

import { ArrayDataFrame } from './ArrayDataFrame';
import { MutableDataFrame } from './MutableDataFrame';
import {
  guessFieldTypeFromValue,
  guessFieldTypes,
  isDataFrame,
  isTableData,
  sortDataFrame,
  toDataFrame,
  toLegacyResponseData,
} from './processDataFrame';

import { getFieldTypeFromValue } from '.';

describe('toDataFrame', () => {
  it('converts timeseries to series', () => {
    const input1 = {
      target: 'Field Name',
      datapoints: [
        [100, 1],
        [200, 2],
      ],
    };
    let series = toDataFrame(input1);
    expect(series.name).toBe(input1.target);
    expect(series.fields[1].name).toBe('Value');

    const v0 = series.fields[0].values;
    const v1 = series.fields[1].values;
    expect(v0.length).toEqual(2);
    expect(v0.get(0)).toEqual(1);
    expect(v0.get(1)).toEqual(2);

    expect(v1.length).toEqual(2);
    expect(v1.get(0)).toEqual(100);
    expect(v1.get(1)).toEqual(200);

    // Should fill a default name if target is empty
    const input2 = {
      // without target
      target: '',
      datapoints: [
        [100, 1],
        [200, 2],
      ],
    };
    series = toDataFrame(input2);
    expect(series.fields[1].name).toEqual('Value');
  });

  it('assumes TimeSeries values are numbers', () => {
    const input1 = {
      target: 'time',
      datapoints: [
        [100, 1],
        [200, 2],
      ],
    };
    const data = toDataFrame(input1);
    expect(data.fields[0].type).toBe(FieldType.time);
    expect(data.fields[1].type).toBe(FieldType.number);
  });

  it('keeps dataFrame unchanged', () => {
    const input = toDataFrame({
      datapoints: [
        [100, 1],
        [200, 2],
      ],
    });
    expect(input.length).toEqual(2);

    // If the object is already a DataFrame, it should not change
    const again = toDataFrame(input);
    expect(again).toBe(input);
  });

  it('Make sure ArrayDataFrame is used as a DataFrame without modification', () => {
    const orig = [
      { a: 1, b: 2 },
      { a: 3, b: 4 },
    ];
    const array = new ArrayDataFrame(orig);
    const frame = toDataFrame(array);
    expect(frame).toEqual(array);
    expect(frame instanceof ArrayDataFrame).toEqual(true);
    expect(frame.length).toEqual(orig.length);
    expect(frame.fields.map((f) => f.name)).toEqual(['a', 'b']);
  });

  it('throws when table rows is not array', () => {
    expect(() =>
      toDataFrame({
        columns: [],
        rows: {},
      })
    ).toThrowError('Expected table rows to be array, got object.');
  });

  it('Guess Column Types from value', () => {
    expect(guessFieldTypeFromValue(1)).toBe(FieldType.number);
    expect(guessFieldTypeFromValue(1.234)).toBe(FieldType.number);
    expect(guessFieldTypeFromValue(3.125e7)).toBe(FieldType.number);
    expect(guessFieldTypeFromValue(true)).toBe(FieldType.boolean);
    expect(guessFieldTypeFromValue(false)).toBe(FieldType.boolean);
    expect(guessFieldTypeFromValue(new Date())).toBe(FieldType.time);
    expect(guessFieldTypeFromValue(dateTime())).toBe(FieldType.time);
  });

  it('Guess Column Types from strings', () => {
    expect(guessFieldTypeFromValue('1')).toBe(FieldType.number);
    expect(guessFieldTypeFromValue('1.234')).toBe(FieldType.number);
    expect(guessFieldTypeFromValue('NaN')).toBe(FieldType.number);
    expect(guessFieldTypeFromValue('3.125e7')).toBe(FieldType.number);
    expect(guessFieldTypeFromValue('True')).toBe(FieldType.boolean);
    expect(guessFieldTypeFromValue('FALSE')).toBe(FieldType.boolean);
    expect(guessFieldTypeFromValue('true')).toBe(FieldType.boolean);
    expect(guessFieldTypeFromValue('xxxx')).toBe(FieldType.string);
  });

  it('Get column types from values', () => {
    expect(getFieldTypeFromValue(1)).toBe(FieldType.number);
    expect(getFieldTypeFromValue(1.234)).toBe(FieldType.number);
    expect(getFieldTypeFromValue(NaN)).toBe(FieldType.number);
    expect(getFieldTypeFromValue(3.125e7)).toBe(FieldType.number);
    expect(getFieldTypeFromValue(true)).toBe(FieldType.boolean);
    expect(getFieldTypeFromValue('xxxx')).toBe(FieldType.string);
  });

  it('Guess Column Types from series', () => {
    const series = new MutableDataFrame({
      fields: [
        { name: 'A (number)', values: [123, null] },
        { name: 'B (strings)', values: [null, 'Hello'] },
        { name: 'C (nulls)', values: [null, null] },
        { name: 'Time', values: ['2000', 1967] },
        { name: 'D (number strings)', values: ['NaN', null, 1] },
      ],
    });
    const norm = guessFieldTypes(series);
    expect(norm.fields[0].type).toBe(FieldType.number);
    expect(norm.fields[1].type).toBe(FieldType.string);
    expect(norm.fields[2].type).toBe(FieldType.other);
    expect(norm.fields[3].type).toBe(FieldType.time); // based on name
    expect(norm.fields[4].type).toBe(FieldType.number);
  });

  it('converts JSON document data to series', () => {
    const input1 = {
      datapoints: [
        {
          _id: 'W5rvjW0BKe0cA-E1aHvr',
          _type: '_doc',
          _index: 'logs-2019.10.02',
          '@message': 'Deployed website',
          '@timestamp': [1570044340458],
          tags: ['deploy', 'website-01'],
          description: 'Torkel deployed website',
          coordinates: { latitude: 12, longitude: 121, level: { depth: 3, coolness: 'very' } },
          'unescaped-content': 'breaking <br /> the <br /> row',
        },
      ],
      filterable: true,
      target: 'docs',
      total: 206,
      type: 'docs',
    };
    const dataFrame = toDataFrame(input1);
    expect(dataFrame.fields[0].name).toBe(input1.target);

    const v0 = dataFrame.fields[0].values;
    expect(v0.length).toEqual(1);
    expect(v0.get(0)).toEqual(input1.datapoints[0]);
  });

  it('converts JSON response to dataframes', () => {
    const msg = {
      schema: {
        fields: [
          {
            name: 'First',
            type: 'string',
          },
          {
            name: 'Second',
            type: 'number',
          },
        ],
      },
      data: {
        values: [
          ['2019-02-15', '2019-03-15', '2019-04-15'],
          [3, 9, 16],
        ],
      },
    };
    const dataFrame = toDataFrame(msg);
    expect(dataFrame.fields.map((f) => ({ [f.name]: f.values.toArray() }))).toMatchInlineSnapshot(`
      [
        {
          "First": ArrayVector [
            "2019-02-15",
            "2019-03-15",
            "2019-04-15",
          ],
        },
        {
          "Second": ArrayVector [
            3,
            9,
            16,
          ],
        },
      ]
    `);
  });
});

describe('SeriesData backwards compatibility', () => {
  it('can convert TimeSeries to series and back again', () => {
    const timeseries = {
      target: 'Field Name',
      datapoints: [
        [100, 1],
        [200, 2],
      ],
    };
    const series = toDataFrame(timeseries);
    expect(isDataFrame(timeseries)).toBeFalsy();
    expect(isDataFrame(series)).toBeTruthy();

    const roundtrip = toLegacyResponseData(series) as TimeSeries;
    expect(isDataFrame(roundtrip)).toBeFalsy();
    expect(roundtrip.target).toBe(timeseries.target);
  });

  it('can convert TimeSeries to series and back again with tags should render name with tags', () => {
    const timeseries = {
      target: 'Series A',
      tags: { server: 'ServerA', job: 'app' },
      datapoints: [
        [100, 1],
        [200, 2],
      ],
    };
    const series = toDataFrame(timeseries);
    expect(isDataFrame(timeseries)).toBeFalsy();
    expect(isDataFrame(series)).toBeTruthy();

    const roundtrip = toLegacyResponseData(series) as TimeSeries;
    expect(isDataFrame(roundtrip)).toBeFalsy();
    expect(roundtrip.target).toBe('{job="app", server="ServerA"}');
  });

  it('can convert empty table to DataFrame then back to legacy', () => {
    const table = {
      columns: [],
      rows: [],
      type: 'table',
    };

    const series = toDataFrame(table);
    const roundtrip = toLegacyResponseData(series) as TableData;
    expect(roundtrip.columns.length).toBe(0);
    expect(roundtrip.type).toBe('table');
  });

  it('converts TableData to series and back again', () => {
    const table = {
      columns: [
        { text: 'a', unit: 'ms' },
        { text: 'b', unit: 'zz' },
        { text: 'c', unit: 'yy' },
      ],
      rows: [
        [100, 1, 'a'],
        [200, 2, 'a'],
      ],
    };
    const series = toDataFrame(table);
    expect(isTableData(table)).toBeTruthy();
    expect(isDataFrame(series)).toBeTruthy();
    expect(series.fields[0].config.unit).toEqual('ms');

    const roundtrip = toLegacyResponseData(series) as TimeSeries;
    expect(isTableData(roundtrip)).toBeTruthy();
    expect(roundtrip).toMatchObject(table);
  });

  it('can convert empty TableData to DataFrame', () => {
    const table = {
      columns: [],
      rows: [],
    };

    const series = toDataFrame(table);
    expect(series.fields.length).toBe(0);
  });

  it('can convert DataFrame to TableData to series and back again', () => {
    const json: DataFrameDTO = {
      refId: 'Z',
      meta: {
        custom: {
          something: 8,
        },
      },
      fields: [
        { name: 'T', type: FieldType.time, values: [1, 2, 3] },
        { name: 'N', type: FieldType.number, config: { filterable: true }, values: [100, 200, 300] },
        { name: 'S', type: FieldType.string, config: { filterable: true }, values: ['1', '2', '3'] },
      ],
    };
    const series = toDataFrame(json);
    const table = toLegacyResponseData(series) as TableData;
    expect(table.refId).toBe(series.refId);
    expect(table.meta).toEqual(series.meta);

    const names = table.columns.map((c) => c.text);
    expect(names).toEqual(['T', 'N', 'S']);
  });

  it('can convert TimeSeries to JSON document and back again', () => {
    const timeseries = {
      datapoints: [
        {
          _id: 'W5rvjW0BKe0cA-E1aHvr',
          _type: '_doc',
          _index: 'logs-2019.10.02',
          '@message': 'Deployed website',
          '@timestamp': [1570044340458],
          tags: ['deploy', 'website-01'],
          description: 'Torkel deployed website',
          coordinates: { latitude: 12, longitude: 121, level: { depth: 3, coolness: 'very' } },
          'unescaped-content': 'breaking <br /> the <br /> row',
        },
      ],
      filterable: true,
      target: 'docs',
      total: 206,
      type: 'docs',
    };
    const series = toDataFrame(timeseries);
    expect(isDataFrame(timeseries)).toBeFalsy();
    expect(isDataFrame(series)).toBeTruthy();

    const roundtrip = toLegacyResponseData(series) as any;
    expect(isDataFrame(roundtrip)).toBeFalsy();
    expect(roundtrip.type).toBe('docs');
    expect(roundtrip.target).toBe('docs');
    expect(roundtrip.filterable).toBeTruthy();
  });
});

describe('sorted DataFrame', () => {
  const frame = toDataFrame({
    fields: [
      { name: 'fist', type: FieldType.time, values: [1, 2, 3] },
      { name: 'second', type: FieldType.string, values: ['a', 'b', 'c'] },
      { name: 'third', type: FieldType.number, values: [2000, 3000, 1000] },
    ],
  });
  it('Should sort numbers', () => {
    const sorted = sortDataFrame(frame, 0, true);
    expect(sorted.length).toEqual(3);
    expect(sorted.fields[0].values.toArray()).toEqual([3, 2, 1]);
    expect(sorted.fields[1].values.toArray()).toEqual(['c', 'b', 'a']);
  });

  it('Should sort strings', () => {
    const sorted = sortDataFrame(frame, 1, true);
    expect(sorted.length).toEqual(3);
    expect(sorted.fields[0].values.toArray()).toEqual([3, 2, 1]);
    expect(sorted.fields[1].values.toArray()).toEqual(['c', 'b', 'a']);
  });
});
