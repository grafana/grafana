import { ArrayVector, DataFrame, FieldType } from '@grafana/data';

import { makeTableFrames } from './makeTableFrames';

const frame1: DataFrame = {
  name: 'frame1',
  refId: 'A',
  meta: {
    executedQueryString: 'something1',
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
      },
      config: {
        displayNameFromDS: '{level="error", location="moon", protocol="http"}',
      },
      values: new ArrayVector([23]),
    },
  ],
  length: 1,
};

const frame2: DataFrame = {
  name: 'frame1',
  refId: 'A',
  meta: {
    executedQueryString: 'something1',
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
        level: 'info',
        location: 'moon',
        protocol: 'http',
      },
      config: {
        displayNameFromDS: '{level="info", location="moon", protocol="http"}',
      },
      values: new ArrayVector([45]),
    },
  ],
  length: 1,
};

const frame3: DataFrame = {
  name: 'frame1',
  refId: 'B',
  meta: {
    executedQueryString: 'something1',
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
      },
      config: {
        displayNameFromDS: '{level="error", location="moon", protocol="http"}',
      },
      values: new ArrayVector([72]),
    },
  ],
  length: 1,
};

const outputSingle = [
  {
    fields: [
      { config: {}, name: 'Time', type: 'time', values: new ArrayVector([1645029699311]) },
      { config: { filterable: true }, name: 'level', type: 'string', values: new ArrayVector(['error']) },
      { config: { filterable: true }, name: 'location', type: 'string', values: new ArrayVector(['moon']) },
      { config: { filterable: true }, name: 'protocol', type: 'string', values: new ArrayVector(['http']) },
      { config: {}, name: 'Value #A', type: 'number', values: new ArrayVector([23]) },
    ],
    length: 1,
    meta: { preferredVisualisationType: 'table' },
    refId: 'A',
  },
];

const outputMulti = [
  {
    fields: [
      { config: {}, name: 'Time', type: 'time', values: new ArrayVector([1645029699311, 1645029699311]) },
      { config: { filterable: true }, name: 'level', type: 'string', values: new ArrayVector(['error', 'info']) },
      { config: { filterable: true }, name: 'location', type: 'string', values: new ArrayVector(['moon', 'moon']) },
      { config: { filterable: true }, name: 'protocol', type: 'string', values: new ArrayVector(['http', 'http']) },
      { config: {}, name: 'Value #A', type: 'number', values: new ArrayVector([23, 45]) },
    ],
    length: 2,
    meta: { preferredVisualisationType: 'table' },
    refId: 'A',
  },
  {
    fields: [
      { config: {}, name: 'Time', type: 'time', values: new ArrayVector([1645029699311]) },
      { config: { filterable: true }, name: 'level', type: 'string', values: new ArrayVector(['error']) },
      { config: { filterable: true }, name: 'location', type: 'string', values: new ArrayVector(['moon']) },
      { config: { filterable: true }, name: 'protocol', type: 'string', values: new ArrayVector(['http']) },
      { config: {}, name: 'Value #B', type: 'number', values: new ArrayVector([72]) },
    ],
    length: 1,
    meta: { preferredVisualisationType: 'table' },
    refId: 'B',
  },
];

describe('loki makeTableFrames', () => {
  it('converts a single instant metric dataframe to table dataframe', () => {
    const result = makeTableFrames([frame1]);
    expect(result).toEqual(outputSingle);
  });

  it('converts 3 instant metric dataframes into 2 tables', () => {
    const result = makeTableFrames([frame1, frame2, frame3]);
    expect(result).toEqual(outputMulti);
  });
});
