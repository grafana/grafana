import { DataFrame, DataFrameType, FieldType } from '@grafana/data';

import { sortDataFrameByTime, SortDirection } from './sortDataFrame';

const classicFrame: DataFrame = {
  refId: 'A',
  fields: [
    {
      name: 'time',
      type: FieldType.time,
      config: {},
      values: [1005, 1001, 1003, 1002, 1003],
      nanos: [0, 0, 5, 0, 0],
    },
    {
      name: 'value',
      type: FieldType.string,
      config: {},
      values: ['line5', 'line1', 'line4', 'line2', 'line3'],
    },
    {
      name: 'tsNs',
      type: FieldType.time,
      config: {},
      values: [`1005000000`, `1001000000`, `1003000005`, `1002000000`, `1003000000`],
    },
  ],
  length: 5,
};

const dataPlaneFrame1: DataFrame = {
  refId: 'A',
  meta: {
    type: DataFrameType.LogLines,
  },
  fields: [
    {
      name: 'timestamp',
      type: FieldType.time,
      config: {},
      values: [1005, 1001, 1004, 1002, 1003],
    },
    {
      name: 'body',
      type: FieldType.string,
      config: {},
      values: ['line5', 'line1', 'line4', 'line2', 'line3'],
    },
  ],
  length: 5,
};

const dataPlaneFrame2: DataFrame = {
  refId: 'A',
  meta: {
    type: DataFrameType.LogLines,
  },
  fields: [
    {
      name: 'timestamp',
      type: FieldType.time,
      config: {},
      values: [1000, 1000, 1000, 1000, 1000],
      nanos: [5, 1, 4, 2, 3],
    },
    {
      name: 'body',
      type: FieldType.string,
      config: {},
      values: ['line5', 'line1', 'line4', 'line2', 'line3'],
    },
  ],
  length: 5,
};

describe('loki sortDataFrame classic', () => {
  it('sorts a dataframe ascending', () => {
    const sortedFrame = sortDataFrameByTime(classicFrame, SortDirection.Ascending);
    expect(sortedFrame.length).toBe(5);
    const timeValues = sortedFrame.fields[0].values;
    const timeNanos = sortedFrame.fields[0].nanos;
    const lineValues = sortedFrame.fields[1].values;
    const tsNsValues = sortedFrame.fields[2].values;

    expect(timeValues).toEqual([1001, 1002, 1003, 1003, 1005]);
    expect(timeNanos).toEqual([0, 0, 0, 5, 0]);
    expect(lineValues).toEqual(['line1', 'line2', 'line3', 'line4', 'line5']);
    expect(tsNsValues).toEqual([`1001000000`, `1002000000`, `1003000000`, `1003000005`, `1005000000`]);
  });
  it('sorts a dataframe descending', () => {
    const sortedFrame = sortDataFrameByTime(classicFrame, SortDirection.Descending);
    expect(sortedFrame.length).toBe(5);
    const timeValues = sortedFrame.fields[0].values;
    const timeNanos = sortedFrame.fields[0].nanos;
    const lineValues = sortedFrame.fields[1].values;
    const tsNsValues = sortedFrame.fields[2].values;

    expect(timeValues).toEqual([1005, 1003, 1003, 1002, 1001]);
    expect(timeNanos).toEqual([0, 5, 0, 0, 0]);
    expect(lineValues).toEqual(['line5', 'line4', 'line3', 'line2', 'line1']);
    expect(tsNsValues).toEqual([`1005000000`, `1003000005`, `1003000000`, `1002000000`, `1001000000`]);
  });
});

describe('loki sortDataFrame dataplane without timefield-nanos', () => {
  it('sorts a dataframe ascending', () => {
    const sortedFrame = sortDataFrameByTime(dataPlaneFrame1, SortDirection.Ascending);
    expect(sortedFrame.length).toBe(5);
    const timeValues = sortedFrame.fields[0].values;
    const timeNanos = sortedFrame.fields[0].nanos;
    const lineValues = sortedFrame.fields[1].values;

    expect(timeValues).toEqual([1001, 1002, 1003, 1004, 1005]);
    expect(timeNanos).toBe(undefined);
    expect(lineValues).toEqual(['line1', 'line2', 'line3', 'line4', 'line5']);
  });
  it('sorts a dataframe descending', () => {
    const sortedFrame = sortDataFrameByTime(dataPlaneFrame1, SortDirection.Descending);
    expect(sortedFrame.length).toBe(5);
    const timeValues = sortedFrame.fields[0].values;
    const lineValues = sortedFrame.fields[1].values;
    const timeNanos = sortedFrame.fields[0].nanos;

    expect(timeValues).toEqual([1005, 1004, 1003, 1002, 1001]);
    expect(timeNanos).toBe(undefined);
    expect(lineValues).toEqual(['line5', 'line4', 'line3', 'line2', 'line1']);
  });
});

describe('loki sortDataFrame dataplane with timefield-nanos', () => {
  it('sorts a dataframe ascending', () => {
    const sortedFrame = sortDataFrameByTime(dataPlaneFrame2, SortDirection.Ascending);
    expect(sortedFrame.length).toBe(5);
    const timeValues = sortedFrame.fields[0].values;
    const timeNanos = sortedFrame.fields[0].nanos;
    const lineValues = sortedFrame.fields[1].values;

    expect(timeValues).toEqual([1000, 1000, 1000, 1000, 1000]);
    expect(timeNanos).toEqual([1, 2, 3, 4, 5]);
    expect(lineValues).toEqual(['line1', 'line2', 'line3', 'line4', 'line5']);
  });
  it('sorts a dataframe descending', () => {
    const sortedFrame = sortDataFrameByTime(dataPlaneFrame2, SortDirection.Descending);
    expect(sortedFrame.length).toBe(5);
    const timeValues = sortedFrame.fields[0].values;
    const timeNanos = sortedFrame.fields[0].nanos;
    const lineValues = sortedFrame.fields[1].values;

    expect(timeValues).toEqual([1000, 1000, 1000, 1000, 1000]);
    expect(timeNanos).toEqual([5, 4, 3, 2, 1]);
    expect(lineValues).toEqual(['line5', 'line4', 'line3', 'line2', 'line1']);
  });
});
