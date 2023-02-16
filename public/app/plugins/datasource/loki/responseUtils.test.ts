import { cloneDeep } from 'lodash';

import { ArrayVector, DataFrame, FieldType } from '@grafana/data';

import {
  dataFrameHasLevelLabel,
  dataFrameHasLokiError,
  extractLevelLikeLabelFromDataFrame,
  extractLogParserFromDataFrame,
  extractLabelKeysFromDataFrame,
  extractUnwrapLabelKeysFromDataFrame,
} from './responseUtils';

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

describe('dataFrameHasParsingError', () => {
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

describe('dataFrameHasLevelLabel', () => {
  it('returns true if level label is present', () => {
    const input = cloneDeep(frame);
    input.fields[1].values = new ArrayVector([{ level: 'info' }]);
    expect(dataFrameHasLevelLabel(input)).toBe(true);
  });
  it('returns false if level label is present', () => {
    const input = cloneDeep(frame);
    input.fields[1].values = new ArrayVector([{ foo: 'bar' }]);
    expect(dataFrameHasLevelLabel(input)).toBe(false);
  });
});

describe('extractLevelLikeLabelFromDataFrame', () => {
  it('returns label if lvl label is present', () => {
    const input = cloneDeep(frame);
    input.fields[1].values = new ArrayVector([{ lvl: 'info' }]);
    expect(extractLevelLikeLabelFromDataFrame(input)).toBe('lvl');
  });
  it('returns label if level-like label is present', () => {
    const input = cloneDeep(frame);
    input.fields[1].values = new ArrayVector([{ error_level: 'info' }]);
    expect(extractLevelLikeLabelFromDataFrame(input)).toBe('error_level');
  });
  it('returns undefined if no level-like label is present', () => {
    const input = cloneDeep(frame);
    input.fields[1].values = new ArrayVector([{ foo: 'info' }]);
    expect(extractLevelLikeLabelFromDataFrame(input)).toBe(null);
  });
});

describe('extractLogParserFromDataFrame', () => {
  it('returns false by default', () => {
    const input = cloneDeep(frame);
    expect(extractLogParserFromDataFrame(input)).toEqual({ hasJSON: false, hasLogfmt: false });
  });
  it('identifies JSON', () => {
    const input = cloneDeep(frame);
    input.fields[2].values = new ArrayVector(['{"a":"b"}']);
    expect(extractLogParserFromDataFrame(input)).toEqual({ hasJSON: true, hasLogfmt: false });
  });
  it('identifies logfmt', () => {
    const input = cloneDeep(frame);
    input.fields[2].values = new ArrayVector(['a=b']);
    expect(extractLogParserFromDataFrame(input)).toEqual({ hasJSON: false, hasLogfmt: true });
  });
});

describe('extractLabelKeysFromDataFrame', () => {
  it('returns empty by default', () => {
    const input = cloneDeep(frame);
    input.fields[1].values = new ArrayVector([]);
    expect(extractLabelKeysFromDataFrame(input)).toEqual([]);
  });
  it('extracts label keys', () => {
    const input = cloneDeep(frame);
    expect(extractLabelKeysFromDataFrame(input)).toEqual(['level']);
  });
});

describe('extractUnwrapLabelKeysFromDataFrame', () => {
  it('returns empty by default', () => {
    const input = cloneDeep(frame);
    input.fields[1].values = new ArrayVector([]);
    expect(extractUnwrapLabelKeysFromDataFrame(input)).toEqual([]);
  });
  it('extracts possible unwrap label keys', () => {
    const input = cloneDeep(frame);
    input.fields[1].values = new ArrayVector([{ number: 13 }]);
    expect(extractUnwrapLabelKeysFromDataFrame(input)).toEqual(['number']);
  });
});
