import { DataFrame, FieldType } from '@grafana/data';

import { sortDataFrameByTime, SortDirection } from './sortDataFrame';

const inputFrame: DataFrame = {
  refId: 'A',
  fields: [
    {
      name: 'time',
      type: FieldType.time,
      config: {},
      values: [1005, 1001, 1004, 1002, 1003],
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
      values: [`1005000000`, `1001000000`, `1004000000`, `1002000000`, `1003000000`],
    },
  ],
  length: 5,
};

describe('loki sortDataFrame', () => {
  it('sorts a dataframe ascending', () => {
    const sortedFrame = sortDataFrameByTime(inputFrame, SortDirection.Ascending);
    expect(sortedFrame.length).toBe(5);
    const timeValues = sortedFrame.fields[0].values;
    const lineValues = sortedFrame.fields[1].values;
    const tsNsValues = sortedFrame.fields[2].values;

    expect(timeValues).toEqual([1001, 1002, 1003, 1004, 1005]);
    expect(lineValues).toEqual(['line1', 'line2', 'line3', 'line4', 'line5']);
    expect(tsNsValues).toEqual([`1001000000`, `1002000000`, `1003000000`, `1004000000`, `1005000000`]);
  });
  it('sorts a dataframe descending', () => {
    const sortedFrame = sortDataFrameByTime(inputFrame, SortDirection.Descending);
    expect(sortedFrame.length).toBe(5);
    const timeValues = sortedFrame.fields[0].values;
    const lineValues = sortedFrame.fields[1].values;
    const tsNsValues = sortedFrame.fields[2].values;

    expect(timeValues).toEqual([1005, 1004, 1003, 1002, 1001]);
    expect(lineValues).toEqual(['line5', 'line4', 'line3', 'line2', 'line1']);
    expect(tsNsValues).toEqual([`1005000000`, `1004000000`, `1003000000`, `1002000000`, `1001000000`]);
  });
});
