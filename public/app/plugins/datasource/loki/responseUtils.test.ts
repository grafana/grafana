import { cloneDeep } from 'lodash';

import { ArrayVector, DataFrame, FieldType } from '@grafana/data';

import { dataFrameHasLokiError } from './responseUtils';

const frame: DataFrame = {
  length: 1,
  fields: [
    {
      name: 'Time',
      config: {},
      type: FieldType.time,
      values: new ArrayVector([1]),
    },
    {
      name: 'labels',
      config: {},
      type: FieldType.other,
      values: new ArrayVector([{ level: 'info' }]),
    },
    {
      name: 'Line',
      config: {},
      type: FieldType.string,
      values: new ArrayVector(['line1']),
    },
  ],
};

describe('dataframeHasParsingError', () => {
  it('handles frame with parsing error', () => {
    const input = cloneDeep(frame);
    input.fields[1].values = new ArrayVector([{ level: 'info', __error__: 'error' }]);
    expect(dataFrameHasLokiError(input)).toBe(true);
  });
  it('handles frame without parsing error', () => {
    const input = cloneDeep(frame);
    expect(dataFrameHasLokiError(input)).toBe(false);
  });
});
