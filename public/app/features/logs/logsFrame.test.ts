import { FieldType, DataFrameType, Field, Labels } from '@grafana/data';

import { parseLogsFrame, logFrameLabelsToLabels } from './logsFrame';

function makeString(name: string, values: string[], labels?: Labels): Field {
  return {
    name,
    type: FieldType.string,
    config: {},
    values,
    labels,
  };
}

function makeTime(name: string, values: number[], nanos?: number[]): Field {
  return {
    name,
    type: FieldType.time,
    config: {},
    values,
  };
}

function makeObject(name: string, values: Object[]): Field {
  return {
    name,
    type: FieldType.other,
    config: {},
    values,
  };
}

describe('parseLogsFrame should parse different logs-dataframe formats', () => {
  it('should parse a dataplane-complaint logs frame', () => {
    const time = makeTime('timestamp', [1687185711795, 1687185711995]);
    const body = makeString('body', ['line1', 'line2']);
    const severity = makeString('severity', ['info', 'debug']);
    const id = makeString('id', ['id1', 'id2']);
    const labels = makeObject('labels', [
      { counter: '38141', label: 'val2', level: 'warning', nested: { a: '1', b: ['2', '3'] } },
      { counter: '38143', label: 'val2', level: 'info', nested: { a: '11', b: ['12', '13'] } },
    ]);

    const result = parseLogsFrame({
      meta: {
        type: DataFrameType.LogLines,
      },
      fields: [id, body, labels, severity, time],
      length: 2,
    });

    expect(result).not.toBeNull();

    expect(result!.timeField.values[0]).toBe(time.values[0]);
    expect(result!.bodyField.values[0]).toBe(body.values[0]);
    expect(result!.idField?.values[0]).toBe(id.values[0]);
    expect(result!.timeNanosecondField).toBeNull();
    expect(result!.severityField?.values[0]).toBe(severity.values[0]);
    expect(result!.getLogFrameLabels()).toStrictEqual([
      { counter: '38141', label: 'val2', level: 'warning', nested: { a: '1', b: ['2', '3'] } },
      { counter: '38143', label: 'val2', level: 'info', nested: { a: '11', b: ['12', '13'] } },
    ]);
    expect(result!.getLogFrameLabelsAsLabels()).toStrictEqual([
      { counter: '38141', label: 'val2', level: 'warning', nested: `{"a":"1","b":["2","3"]}` },
      { counter: '38143', label: 'val2', level: 'info', nested: `{"a":"11","b":["12","13"]}` },
    ]);
    expect(result?.extraFields).toStrictEqual([]);
  });

  it('should parse old Loki-style (grafana8.x) frames ( multi-frame, but here we only parse a single frame )', () => {
    const time = makeTime('ts', [1687185711795, 1687185711995]);
    const line = makeString('line', ['line1', 'line2'], { counter: '34543', lable: 'val3', level: 'info' });
    const id = makeString('id', ['id1', 'id2']);
    const ns = makeString('tsNs', ['1687185711795123456', '1687185711995987654']);

    const result = parseLogsFrame({
      fields: [time, line, ns, id],
      length: 2,
    });

    expect(result).not.toBeNull();

    expect(result!.timeField.values[0]).toBe(time.values[0]);
    expect(result!.bodyField.values[0]).toBe(line.values[0]);
    expect(result!.idField?.values[0]).toBe(id.values[0]);
    expect(result!.timeNanosecondField?.values[0]).toBe(ns.values[0]);
    expect(result!.severityField).toBeNull();
    expect(result!.getLogFrameLabels()).toStrictEqual([
      { counter: '34543', lable: 'val3', level: 'info' },
      { counter: '34543', lable: 'val3', level: 'info' },
    ]);
    expect(result!.getLogFrameLabelsAsLabels()).toStrictEqual([
      { counter: '34543', lable: 'val3', level: 'info' },
      { counter: '34543', lable: 'val3', level: 'info' },
    ]);
    expect(result?.extraFields).toStrictEqual([]);
  });

  it('should parse frames with labels field of type other', () => {
    const time = makeTime('Time', [1687185711795, 1687185711995]);
    const line = makeString('Line', ['line1', 'line2']);
    const id = makeString('id', ['id1', 'id2']);
    const ns = makeString('tsNs', ['1687185711795123456', '1687185711995987654']);
    const labels = makeObject('labels', [
      { counter: '38141', label: 'val2', level: 'warning' },
      { counter: '38143', label: 'val2', level: 'info' },
    ]);

    const result = parseLogsFrame({
      fields: [labels, time, line, ns, id],
      length: 2,
    });

    expect(result).not.toBeNull();

    expect(result!.timeField.values[0]).toBe(time.values[0]);
    expect(result!.bodyField.values[0]).toBe(line.values[0]);
    expect(result!.idField?.values[0]).toBe(id.values[0]);
    expect(result!.timeNanosecondField?.values[0]).toBe(ns.values[0]);
    expect(result!.severityField).toBeNull();
    expect(result!.getLogFrameLabels()).toStrictEqual([
      { counter: '38141', label: 'val2', level: 'warning' },
      { counter: '38143', label: 'val2', level: 'info' },
    ]);
    expect(result!.getLogFrameLabelsAsLabels()).toStrictEqual([
      { counter: '38141', label: 'val2', level: 'warning' },
      { counter: '38143', label: 'val2', level: 'info' },
    ]);
    expect(result?.extraFields).toStrictEqual([]);
  });

  it('should parse a Loki-style frame (single-frame, labels-in-json)', () => {
    const time = makeTime('Time', [1687185711795, 1687185711995]);
    const line = makeString('Line', ['line1', 'line2']);
    const id = makeString('id', ['id1', 'id2']);
    const ns = makeString('tsNs', ['1687185711795123456', '1687185711995987654']);
    const labels = makeObject('labels', [
      { counter: '38141', label: 'val2', level: 'warning' },
      { counter: '38143', label: 'val2', level: 'info' },
    ]);

    const result = parseLogsFrame({
      meta: {
        custom: {
          frameType: 'LabeledTimeValues',
        },
      },
      fields: [labels, time, line, ns, id],
      length: 2,
    });

    expect(result).not.toBeNull();

    expect(result!.timeField.values[0]).toBe(time.values[0]);
    expect(result!.bodyField.values[0]).toBe(line.values[0]);
    expect(result!.idField?.values[0]).toBe(id.values[0]);
    expect(result!.timeNanosecondField?.values[0]).toBe(ns.values[0]);
    expect(result!.severityField).toBeNull();
    expect(result!.getLogFrameLabels()).toStrictEqual([
      { counter: '38141', label: 'val2', level: 'warning' },
      { counter: '38143', label: 'val2', level: 'info' },
    ]);
    expect(result!.getLogFrameLabelsAsLabels()).toStrictEqual([
      { counter: '38141', label: 'val2', level: 'warning' },
      { counter: '38143', label: 'val2', level: 'info' },
    ]);
    expect(result?.extraFields).toStrictEqual([]);
  });

  it('should parse elastic-style frame (has level-field, no labels parsed, with extra unused fields)', () => {
    const time = makeTime('Time', [1687185711795, 1687185711995]);
    const line = makeString('Line', ['line1', 'line2']);
    const source = makeObject('_source', [
      { counter: '38141', label: 'val2', level: 'warning' },
      { counter: '38143', label: 'val2', level: 'info' },
    ]);
    const host = makeString('hostname', ['h1', 'h2']);
    const level = makeString('level', ['info', 'error']);

    const result = parseLogsFrame({
      fields: [time, line, source, level, host],
      length: 2,
    });

    expect(result).not.toBeNull();

    expect(result!.timeField.values[0]).toBe(time.values[0]);
    expect(result!.bodyField.values[0]).toBe(line.values[0]);
    expect(result!.severityField?.values[0]).toBe(level.values[0]);
    expect(result!.idField).toBeNull();
    expect(result!.timeNanosecondField).toBeNull();
    expect(result!.getLogFrameLabelsAsLabels()).toBeNull();
    expect(result!.getLogFrameLabels()).toBeNull();
    expect(result?.extraFields.map((f) => f.name)).toStrictEqual(['_source', 'hostname']);
  });

  it('should parse a minimal old-style frame (only two fields, time and line)', () => {
    const time = makeTime('Time', [1687185711795, 1687185711995]);
    const line = makeString('Line', ['line1', 'line2']);

    const result = parseLogsFrame({
      fields: [time, line],
      length: 2,
    });

    expect(result).not.toBeNull();

    expect(result!.timeField.values[0]).toBe(time.values[0]);
    expect(result!.bodyField.values[0]).toBe(line.values[0]);
    expect(result!.severityField).toBeNull();
    expect(result!.idField).toBeNull();
    expect(result!.timeNanosecondField).toBeNull();
    expect(result!.getLogFrameLabelsAsLabels()).toBeNull();
    expect(result!.getLogFrameLabels()).toBeNull();
    expect(result?.extraFields).toStrictEqual([]);
  });

  it('should parse an old-style frame with a hidden string field', () => {
    const time = makeTime('Time', [1687185711795, 1687185711995]);
    const hidden = makeString('Hidden', ['hidden1', 'hidden2']);
    const line = makeString('Line', ['line1', 'line2']);

    hidden.config.custom = {
      hidden: true,
    };

    const result = parseLogsFrame({
      fields: [time, hidden, line],
      length: 2,
    });

    expect(result).not.toBeNull();

    expect(result!.timeField.values[0]).toBe(time.values[0]);
    expect(result!.bodyField.values[0]).toBe(line.values[0]);
    expect(result!.severityField).toBeNull();
    expect(result!.idField).toBeNull();
    expect(result!.timeNanosecondField).toBeNull();
    expect(result!.getLogFrameLabelsAsLabels()).toBeNull();
    expect(result!.getLogFrameLabels()).toBeNull();
  });
});

describe('logFrameLabelsToLabels', () => {
  it('should convert nested structures correctly', () => {
    expect(
      logFrameLabelsToLabels({
        key1: 'val1',
        key2: ['k2v1', 'k2v2', 'k2v3'],
        key3: {
          k3k1: 'v1',
          k3k2: 'v2',
          k3k3: [
            'k3k3v1',
            {
              k3k3k1: 'one',
              k3k3k2: 'two',
            },
          ],
        },
      })
    ).toStrictEqual({
      key1: 'val1',
      key2: '["k2v1","k2v2","k2v3"]',
      key3: '{"k3k1":"v1","k3k2":"v2","k3k3":["k3k3v1",{"k3k3k1":"one","k3k3k2":"two"}]}',
    });
  });

  it('should convert not-nested structures correctly', () => {
    expect(
      logFrameLabelsToLabels({
        key1: 'val1',
        key2: 'val2',
      })
    ).toStrictEqual({
      key1: 'val1',
      key2: 'val2',
    });
    // FIXME
  });
});
