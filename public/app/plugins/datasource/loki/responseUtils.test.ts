import { cloneDeep } from 'lodash';

import { DataFrame, FieldType } from '@grafana/data';

import {
  dataFrameHasLevelLabel,
  dataFrameHasLokiError,
  extractLevelLikeLabelFromDataFrame,
  extractLogParserFromDataFrame,
  extractLabelKeysFromDataFrame,
  extractUnwrapLabelKeysFromDataFrame,
} from './responseUtils';
import { LabelType } from './types';

const frame: DataFrame = {
  length: 1,
  fields: [
    {
      name: 'Time',
      config: {},
      type: FieldType.time,
      values: [1],
    },
    {
      name: 'labels',
      config: {},
      type: FieldType.other,
      values: [{ level: 'info' }],
    },
    {
      name: 'Line',
      config: {},
      type: FieldType.string,
      values: ['line1'],
    },
  ],
};

const frameWithTypes: DataFrame = {
  length: 1,
  fields: [
    {
      name: 'Time',
      config: {},
      type: FieldType.time,
      values: [1],
    },
    {
      name: 'labels',
      config: {},
      type: FieldType.other,
      values: [{ level: 'info', structured: 'foo' }],
    },
    {
      name: 'Line',
      config: {},
      type: FieldType.string,
      values: ['line1'],
    },
    {
      name: 'labelTypes',
      config: {},
      type: FieldType.other,
      values: [{ level: 'I', structured: 'S' }],
    },
  ],
};

const frameWithMultipleLabels: DataFrame = {
  length: 1,
  fields: [
    {
      name: 'Time',
      config: {},
      type: FieldType.time,
      values: [1, 2, 3],
    },
    {
      name: 'labels',
      config: {},
      type: FieldType.other,
      values: [
        { level: 'info', foo: 'bar' },
        { level: 'info', foo: 'baz', new: 'yes' },
        { level: 'error', foo: 'baz' },
      ],
    },
    {
      name: 'Line',
      config: {},
      type: FieldType.string,
      values: ['line1', 'line2', 'line3'],
    },
  ],
};

describe('dataFrameHasParsingError', () => {
  it('handles frame with parsing error', () => {
    const input = cloneDeep(frame);
    input.fields[1].values = [{ level: 'info', __error__: 'error' }];
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
    input.fields[1].values = [{ level: 'info' }];
    expect(dataFrameHasLevelLabel(input)).toBe(true);
  });
  it('returns false if level label is present', () => {
    const input = cloneDeep(frame);
    input.fields[1].values = [{ foo: 'bar' }];
    expect(dataFrameHasLevelLabel(input)).toBe(false);
  });
});

describe('extractLevelLikeLabelFromDataFrame', () => {
  it('returns label if lvl label is present', () => {
    const input = cloneDeep(frame);
    input.fields[1].values = [{ lvl: 'info' }];
    expect(extractLevelLikeLabelFromDataFrame(input)).toBe('lvl');
  });
  it('returns label if level-like label is present', () => {
    const input = cloneDeep(frame);
    input.fields[1].values = [{ error_level: 'info' }];
    expect(extractLevelLikeLabelFromDataFrame(input)).toBe('error_level');
  });
  it('returns undefined if no level-like label is present', () => {
    const input = cloneDeep(frame);
    input.fields[1].values = [{ foo: 'info' }];
    expect(extractLevelLikeLabelFromDataFrame(input)).toBe(null);
  });
});

describe('extractLogParserFromDataFrame', () => {
  it('returns false by default', () => {
    const input = cloneDeep(frame);
    expect(extractLogParserFromDataFrame(input)).toEqual({ hasJSON: false, hasLogfmt: false, hasPack: false });
  });
  it('identifies JSON', () => {
    const input = cloneDeep(frame);
    input.fields[2].values = ['{"a":"b"}'];
    expect(extractLogParserFromDataFrame(input)).toEqual({ hasJSON: true, hasLogfmt: false, hasPack: false });
  });
  it('identifies logfmt', () => {
    const input = cloneDeep(frame);
    input.fields[2].values = ['a=b'];
    expect(extractLogParserFromDataFrame(input)).toEqual({ hasJSON: false, hasLogfmt: true, hasPack: false });
  });
});

describe('extractLabelKeysFromDataFrame', () => {
  it('returns empty by default', () => {
    const input = cloneDeep(frame);
    input.fields[1].values = [];
    expect(extractLabelKeysFromDataFrame(input)).toEqual([]);
  });

  it('extracts label keys', () => {
    const input = cloneDeep(frame);
    expect(extractLabelKeysFromDataFrame(input)).toEqual(['level']);
  });

  it('extracts label keys from all logs', () => {
    const input = cloneDeep(frameWithMultipleLabels);
    expect(extractLabelKeysFromDataFrame(input)).toEqual(['level', 'foo', 'new']);
  });

  it('extracts indexed label keys', () => {
    const input = cloneDeep(frameWithTypes);
    expect(extractLabelKeysFromDataFrame(input)).toEqual(['level']);
  });

  it('extracts structured metadata label keys', () => {
    const input = cloneDeep(frameWithTypes);
    expect(extractLabelKeysFromDataFrame(input, LabelType.StructuredMetadata)).toEqual(['structured']);
  });

  it('does not extract structured metadata label keys from non-typed frame', () => {
    const input = cloneDeep(frame);
    expect(extractLabelKeysFromDataFrame(input, LabelType.StructuredMetadata)).toEqual([]);
  });
});

describe('extractUnwrapLabelKeysFromDataFrame', () => {
  it('returns empty by default', () => {
    const input = cloneDeep(frame);
    input.fields[1].values = [];
    expect(extractUnwrapLabelKeysFromDataFrame(input)).toEqual([]);
  });
  it('extracts possible unwrap label keys', () => {
    const input = cloneDeep(frame);
    input.fields[1].values = [{ number: 13 }];
    expect(extractUnwrapLabelKeysFromDataFrame(input)).toEqual(['number']);
  });
});
