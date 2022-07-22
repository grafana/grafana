import { ArrayVector, DataFrame, FieldType } from '@grafana/data';

import { sortDataFrameByTime } from './sortDataFrame';

const inputFrame: DataFrame = {
  refId: 'A',
  fields: [
    {
      name: 'time',
      type: FieldType.time,
      config: {},
      values: new ArrayVector([1005, 1001, 1004, 1002, 1003]),
    },
    {
      name: 'value',
      type: FieldType.string,
      config: {},
      values: new ArrayVector(['line5', 'line1', 'line4', 'line2', 'line3']),
    },
    {
      name: 'tsNs',
      type: FieldType.time,
      config: {},
      values: new ArrayVector([`1005000000`, `1001000000`, `1004000000`, `1002000000`, `1003000000`]),
    },
  ],
  length: 5,
};

describe('loki sortDataFrame', () => {
  it('sorts a dataframe ascending', () => {
    const sortedFrame = sortDataFrameByTime(inputFrame, 'ASCENDING');
    expect(sortedFrame.length).toBe(5);
    const timeValues = sortedFrame.fields[0].values.toArray();
    const lineValues = sortedFrame.fields[1].values.toArray();
    const tsNsValues = sortedFrame.fields[2].values.toArray();

    expect(timeValues).toStrictEqual([1001, 1002, 1003, 1004, 1005]);
    expect(lineValues).toStrictEqual(['line1', 'line2', 'line3', 'line4', 'line5']);
    expect(tsNsValues).toStrictEqual([`1001000000`, `1002000000`, `1003000000`, `1004000000`, `1005000000`]);
  });
  it('sorts a dataframe descending', () => {
    const sortedFrame = sortDataFrameByTime(inputFrame, 'DESCENDING');
    expect(sortedFrame.length).toBe(5);
    const timeValues = sortedFrame.fields[0].values.toArray();
    const lineValues = sortedFrame.fields[1].values.toArray();
    const tsNsValues = sortedFrame.fields[2].values.toArray();

    expect(timeValues).toStrictEqual([1005, 1004, 1003, 1002, 1001]);
    expect(lineValues).toStrictEqual(['line5', 'line4', 'line3', 'line2', 'line1']);
    expect(tsNsValues).toStrictEqual([`1005000000`, `1004000000`, `1003000000`, `1002000000`, `1001000000`]);
  });
});
