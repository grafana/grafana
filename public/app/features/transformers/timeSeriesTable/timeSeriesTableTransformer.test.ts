import { toDataFrame, FieldType, Labels, DataFrame, Field } from '@grafana/data';

import { timeSeriesToTableTransform } from './timeSeriesTableTransformer';

describe('timeSeriesTableTransformer', () => {
  it('Will transform a single query', () => {
    const series = [
      getTimeSeries('A', { instance: 'A', pod: 'B' }),
      getTimeSeries('A', { instance: 'A', pod: 'C' }),
      getTimeSeries('A', { instance: 'A', pod: 'D' }),
    ];

    const results = timeSeriesToTableTransform({}, series);
    expect(results).toHaveLength(1);
    const result = results[0];
    expect(result.refId).toBe('A');
    expect(result.fields).toHaveLength(3);
    expect(result.fields[0].values).toEqual(['A', 'A', 'A']);
    expect(result.fields[1].values).toEqual(['B', 'C', 'D']);
    assertDataFrameField(result.fields[2], series);
  });

  it('Will pass through non time series frames', () => {
    const series = [
      getTable('B', ['foo', 'bar']),
      getTimeSeries('A', { instance: 'A', pod: 'B' }),
      getTimeSeries('A', { instance: 'A', pod: 'C' }),
      getTable('C', ['bar', 'baz', 'bad']),
    ];

    const results = timeSeriesToTableTransform({}, series);
    expect(results).toHaveLength(3);
    expect(results[0]).toEqual(series[0]);
    expect(results[1].refId).toBe('A');
    expect(results[1].fields).toHaveLength(3);
    expect(results[1].fields[0].values).toEqual(['A', 'A']);
    expect(results[1].fields[1].values).toEqual(['B', 'C']);
    expect(results[2]).toEqual(series[3]);
  });

  it('Will group by refId', () => {
    const series = [
      getTimeSeries('A', { instance: 'A', pod: 'B' }),
      getTimeSeries('A', { instance: 'A', pod: 'C' }),
      getTimeSeries('A', { instance: 'A', pod: 'D' }),
      getTimeSeries('B', { instance: 'B', pod: 'F', cluster: 'A' }),
      getTimeSeries('B', { instance: 'B', pod: 'G', cluster: 'B' }),
    ];

    const results = timeSeriesToTableTransform({}, series);
    expect(results).toHaveLength(2);
    expect(results[0].refId).toBe('A');
    expect(results[0].fields).toHaveLength(3);
    expect(results[0].fields[0].values).toEqual(['A', 'A', 'A']);
    expect(results[0].fields[1].values).toEqual(['B', 'C', 'D']);
    assertDataFrameField(results[0].fields[2], series.slice(0, 3));
    expect(results[1].refId).toBe('B');
    expect(results[1].fields).toHaveLength(4);
    expect(results[1].fields[0].values).toEqual(['B', 'B']);
    expect(results[1].fields[1].values).toEqual(['F', 'G']);
    expect(results[1].fields[2].values).toEqual(['A', 'B']);
    assertDataFrameField(results[1].fields[3], series.slice(3, 5));
  });
});

function assertFieldsEqual(field1: Field, field2: Field) {
  expect(field1.type).toEqual(field2.type);
  expect(field1.name).toEqual(field2.name);
  expect(field1.values).toEqual(field2.values);
  expect(field1.labels ?? {}).toEqual(field2.labels ?? {});
}

function assertDataFrameField(field: Field, matchesFrames: DataFrame[]) {
  const frames: DataFrame[] = field.values;
  expect(frames).toHaveLength(matchesFrames.length);
  frames.forEach((frame, idx) => {
    const matchingFrame = matchesFrames[idx];
    expect(frame.fields).toHaveLength(matchingFrame.fields.length);
    frame.fields.forEach((field, fidx) => assertFieldsEqual(field, matchingFrame.fields[fidx]));
  });
}

function getTimeSeries(refId: string, labels: Labels) {
  return toDataFrame({
    refId,
    fields: [
      { name: 'Time', type: FieldType.time, values: [10] },
      {
        name: 'Value',
        type: FieldType.number,
        values: [10],
        labels,
      },
    ],
  });
}

function getTable(refId: string, fields: string[]) {
  return toDataFrame({
    refId,
    fields: fields.map((f) => ({ name: f, type: FieldType.string, values: ['value'] })),
    labels: {},
  });
}
