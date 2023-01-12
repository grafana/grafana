import { ArrayVector, DataFrame, Field, FieldType, QueryResultMeta } from '@grafana/data';

import { parseLogsFrame } from './logsFrame';

const timeField: Field = {
  name: 'Time',
  type: FieldType.time,
  config: {},
  values: new ArrayVector([1, 2]),
};

const lineField: Field = {
  name: 'Line',
  type: FieldType.string,
  config: {},
  values: new ArrayVector(['line1', 'line2']),
};

const labelsField: Field = {
  name: 'labels',
  type: FieldType.other,
  config: {},
  values: new ArrayVector([
    { level: 'info', code: '41' },
    { level: 'error', code: '42' },
  ]),
};

const timeNanosecondField: Field = {
  name: 'tsNs',
  type: FieldType.string,
  config: {},
  values: new ArrayVector(['1000000', '2000000']),
};

const idField: Field = {
  name: 'id',
  type: FieldType.string,
  config: {},
  values: new ArrayVector(['id1', 'id2']),
};

const logLevelField: Field = {
  name: 'level',
  type: FieldType.string,
  config: {},
  values: new ArrayVector(['level1', 'level2']),
};

const meta: QueryResultMeta = {
  custom: {
    frameType: 'LabeledTimeValues',
  },
};

const length = 2;

describe('logs frame parsing', () => {
  it('invalid frames should be parsed as null', () => {
    const f1: DataFrame = { fields: [], length };
    const f2: DataFrame = { fields: [timeField], length };
    const f3: DataFrame = { fields: [lineField], length };

    expect(parseLogsFrame(f1)).toBeNull();
    expect(parseLogsFrame(f2)).toBeNull();
    expect(parseLogsFrame(f3)).toBeNull();
  });

  it('minimal frame', () => {
    const minimalFrame: DataFrame = { meta, fields: [timeField, lineField], length };
    const p = parseLogsFrame(minimalFrame);
    expect(p).not.toBeNull();
    expect(p?.timeField.values.get(1)).toBe(2);
    expect(p?.lineField.values.get(1)).toBe('line2');
    expect(p?.idField).toBeUndefined();
    expect(p?.timeNanosecondField).toBeUndefined();
    expect(p?.logLevelField).toBeUndefined();
    expect(p?.getLabels()).toStrictEqual([{}, {}]);
  });

  it('minimal frame, field-labels attribute', () => {
    const l: Field = {
      labels: { l1: 'v1' },
      ...lineField,
    };
    const minimalFrame: DataFrame = { fields: [timeField, l], length };
    const p = parseLogsFrame(minimalFrame);
    expect(p).not.toBeNull();
    expect(p?.timeField.values.get(1)).toBe(2);
    expect(p?.lineField.values.get(1)).toBe('line2');
    expect(p?.idField).toBeUndefined();
    expect(p?.timeNanosecondField).toBeUndefined();
    expect(p?.logLevelField).toBeUndefined();
    expect(p?.getLabels()).toStrictEqual([{ l1: 'v1' }, { l1: 'v1' }]);
  });

  it('minimal frame, missing labels-field, but it should have it', () => {
    const minimalFrame: DataFrame = { meta, fields: [timeField, lineField], length };
    const p = parseLogsFrame(minimalFrame);
    expect(p).not.toBeNull();
    expect(p?.timeField.values.get(1)).toBe(2);
    expect(p?.lineField.values.get(1)).toBe('line2');
    expect(p?.idField).toBeUndefined();
    expect(p?.timeNanosecondField).toBeUndefined();
    expect(p?.logLevelField).toBeUndefined();
    expect(p?.getLabels()).toStrictEqual([{}, {}]);
  });

  it('complete frame', () => {
    const minimalFrame: DataFrame = {
      meta,
      fields: [timeField, lineField, idField, timeNanosecondField, logLevelField, labelsField],
      length,
    };
    const p = parseLogsFrame(minimalFrame);
    expect(p).not.toBeNull();
    expect(p?.timeField.values.get(1)).toBe(2);
    expect(p?.lineField.values.get(1)).toBe('line2');
    expect(p?.idField?.values.get(1)).toBe('id2');
    expect(p?.timeNanosecondField?.values.get(1)).toBe('2000000');
    expect(p?.logLevelField?.values.get(1)).toBe('level2');
    expect(p?.getLabels()).toStrictEqual([
      { level: 'info', code: '41' },
      { level: 'error', code: '42' },
    ]);
  });
});
