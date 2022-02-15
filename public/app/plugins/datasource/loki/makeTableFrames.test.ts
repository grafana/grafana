import { ArrayVector, DataFrame, FieldType } from '@grafana/data';
import { makeTableFrames } from './makeTableFrames';

const inputDataFrames: DataFrame[] = [
  {
    name: 'frame1',
    refId: 'A',
    meta: {
      executedQueryString: 'something',
    },
    fields: [
      {
        name: 'Time',
        type: FieldType.time,
        config: {},
        values: new ArrayVector([1645029699311]),
      },
      {
        name: 'Value',
        type: FieldType.number,
        labels: {
          level: 'error',
          location: 'moon',
          protocol: 'http',
          start: '2022-02-16T13:15:10.119426',
        },
        config: {
          displayNameFromDS: '{level="error", location="moon", protocol="http", start="2022-02-16T13:15:10.119426"}',
        },
        values: new ArrayVector([23]),
      },
    ],
    length: 1,
  },
];

const output = [
  {
    fields: [
      { config: {}, name: 'Time', type: 'time', values: new ArrayVector([1645029699311]) },
      { config: { filterable: true }, name: 'level', type: 'string', values: new ArrayVector(['error']) },
      { config: { filterable: true }, name: 'location', type: 'string', values: new ArrayVector(['moon']) },
      { config: { filterable: true }, name: 'protocol', type: 'string', values: new ArrayVector(['http']) },
      {
        config: { filterable: true },
        name: 'start',
        type: 'string',
        values: new ArrayVector(['2022-02-16T13:15:10.119426']),
      },
      { config: {}, name: 'Value #A', type: 'number', values: new ArrayVector([23]) },
    ],
    length: 1,
    meta: { preferredVisualisationType: 'table' },
    refId: 'A',
  },
];

describe('loki backendResultTransformer', () => {
  it('converts instant metric dataframes to table dataframes', () => {
    const result = makeTableFrames(inputDataFrames);
    expect(result).toEqual(output);
  });
});
