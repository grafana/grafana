import { toDataFrame, FieldType, Labels, DataFrame, Field, ReducerID } from '@grafana/data';

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
    expect(results[2].refId).toBe('A');
    expect(results[2].fields).toHaveLength(3);
    expect(results[2].fields[0].values).toEqual(['A', 'A']);
    expect(results[2].fields[1].values).toEqual(['B', 'C']);
    expect(results[1]).toEqual(series[3]);
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

  it('Will include last value by deault', () => {
    const series = [
      getTimeSeries('A', { instance: 'A', pod: 'B' }, [4, 2, 3]),
      getTimeSeries('A', { instance: 'A', pod: 'C' }, [3, 4, 5]),
    ];

    const results = timeSeriesToTableTransform({}, series);
    expect(results[0].fields[2].values[0].value).toEqual(3);
    expect(results[0].fields[2].values[1].value).toEqual(5);
  });

  it('Will calculate average value if configured', () => {
    const series = [
      getTimeSeries('A', { instance: 'A', pod: 'B' }, [4, 2, 3]),
      getTimeSeries('B', { instance: 'A', pod: 'C' }, [3, 4, 5]),
      getTimeSeries('C', { instance: 'B', pod: 'X' }, [4, 2, 0]),
      getTimeSeries('D', { instance: 'B', pod: 'Y' }, [0, 0, 0]),
    ];

    const results = timeSeriesToTableTransform(
      {
        B: {
          stat: ReducerID.mean,
        },
        D: {
          stat: ReducerID.mean,
        },
      },
      series
    );

    expect(results[0].fields[2].values[0].value).toEqual(3);
    expect(results[1].fields[2].values[0].value).toEqual(4);
    expect(results[2].fields[2].values[0].value).toEqual(0);
    expect(results[3].fields[2].values[0].value).toEqual(0);
  });

  it('calculate the value for an empty series to null', () => {
    const series = [getTimeSeries('D', { instance: 'B', pod: 'Y' }, [])];

    const results = timeSeriesToTableTransform(
      {
        B: {
          stat: ReducerID.mean,
        },
        D: {
          stat: ReducerID.mean,
        },
      },
      series
    );

    expect(results[0].fields[2].values[0].value).toEqual(null);
  });

  it('Will transform multiple data series with the same label', () => {
    const series = [
      getTimeSeries('A', { instance: 'A', pod: 'B' }, [4, 2, 3]),
      getTimeSeries('B', { instance: 'A', pod: 'B' }, [3, 4, 5]),
      getTimeSeries('C', { instance: 'A', pod: 'B' }, [3, 4, 5]),
    ];

    const results = timeSeriesToTableTransform({}, series);

    // Check series A
    expect(results[0].fields).toHaveLength(3);
    expect(results[0].fields[0].values[0]).toBe('A');
    expect(results[0].fields[1].values[0]).toBe('B');

    // Check series B
    expect(results[1].fields).toHaveLength(3);
    expect(results[1].fields[0].values[0]).toBe('A');
    expect(results[1].fields[1].values[0]).toBe('B');

    // Check series C
    expect(results[2].fields).toHaveLength(3);
    expect(results[2].fields[0].values[0]).toBe('A');
    expect(results[2].fields[1].values[0]).toBe('B');
  });

  it('will not transform frames with time fields that are non-timeseries', () => {
    const series = [
      getTimeSeries('A', { instance: 'A', pod: 'B' }, [4, 2, 3]),
      getNonTimeSeries('B', { instance: 'A', pod: 'B' }, [3, 4, 5]),
    ];

    const results = timeSeriesToTableTransform({}, series);

    // Expect the timeseries to be transformed
    // Having a trend field will show this
    expect(results[1].fields[2].name).toBe('Trend #A');

    // We should expect the field length to remain at
    // 2 with a time field and a value field
    expect(results[0].fields.length).toBe(2);
  });

  it('will not transform series that have the same value for all times', () => {
    const series = [getNonTimeSeries('A', { instance: 'A' }, [4, 2, 5], [1699476339, 1699476339, 1699476339])];

    const results = timeSeriesToTableTransform({}, series);

    expect(results[0].fields[0].values[0]).toBe(1699476339);
    expect(results[0].fields[1].values[0]).toBe(4);
  });

  it('will transform a series with two time fields', () => {
    const frame = toDataFrame({
      refId: 'A',
      fields: [
        { name: 'Time', type: FieldType.time, values: [0, 50, 90] },
        { name: 'UpdateTime', type: FieldType.time, values: [10, 100, 100] },
        {
          name: 'Value',
          type: FieldType.number,
          values: [2, 3, 4],
        },
      ],
    });

    const results = timeSeriesToTableTransform({}, [frame]);

    // We should have a created trend field
    // with the first time field used as a time
    // and the values coming along with that
    expect(results[0].fields[0].name).toBe('Trend #A');
    expect(results[0].fields[0].values[0].fields[0].values[0]).toBe(0);
    expect(results[0].fields[0].values[0].fields[1].values[0]).toBe(2);
  });

  it('will transform a series with two time fields and a time field configured', () => {
    const frame = toDataFrame({
      refId: 'A',
      fields: [
        { name: 'Time', type: FieldType.time, values: [0, 50, 90] },
        { name: 'UpdateTime', type: FieldType.time, values: [10, 100, 100] },
        {
          name: 'Value',
          type: FieldType.number,
          values: [2, 3, 4],
        },
      ],
    });

    const results = timeSeriesToTableTransform({ A: { timeField: 'UpdateTime' } }, [frame]);

    // We should have a created trend field
    // with the "UpdateTime" time field used as a time
    // and the values coming along with that
    expect(results[0].fields[0].name).toBe('Trend #A');
    expect(results[0].fields[0].values[0].fields[0].values[0]).toBe(10);
    expect(results[0].fields[0].values[0].fields[1].values[0]).toBe(2);
  });

  it('Will correctly fill in gaps in labels', () => {
    const series = [
      getTimeSeries('A', { instance: 'A', pod: 'AA' }),
      getTimeSeries('A', { instance: 'B' }),
      getTimeSeries('A', { instance: 'C', pod: 'CC' }),
    ];

    const results = timeSeriesToTableTransform({}, series);
    expect(results).toHaveLength(1);
    const result = results[0];
    expect(result.refId).toBe('A');
    expect(result.fields).toHaveLength(3);
    expect(result.fields[0].values).toEqual(['A', 'B', 'C']);
    expect(result.fields[1].values).toEqual(['AA', '', 'CC']);
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

function getTimeSeries(refId: string, labels: Labels, values: number[] = [10]) {
  return toDataFrame({
    refId,
    fields: [
      { name: 'Time', type: FieldType.time, values: [10] },
      {
        name: 'Value',
        type: FieldType.number,
        values,
        labels,
      },
    ],
  });
}

function getNonTimeSeries(refId: string, labels: Labels, values: number[], times?: number[]) {
  if (times === undefined) {
    times = [1699476339, 1699475339, 1699476300];
  }

  return toDataFrame({
    refId,
    fields: [
      // These times are in non-ascending order
      // and thus this isn't a timeseries
      { name: 'Time', type: FieldType.time, values: times },
      {
        name: 'Value',
        type: FieldType.number,
        values,
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
