import { ArrayVector, FieldType, MutableDataFrame } from '@grafana/data';

import { applyNullInsertThreshold } from './nullInsertThreshold';

function randInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1) + min);
}

function genFrame() {
  let fieldCount = 10;
  let valueCount = 3000;
  let step = 1000;
  let skipProb = 0.5;
  let skipSteps = [1, 5]; // min, max

  let allValues = Array(fieldCount);

  allValues[0] = Array(valueCount);

  for (let i = 0, curStep = Date.now(); i < valueCount; i++) {
    curStep = allValues[0][i] = curStep + step * (Math.random() < skipProb ? randInt(skipSteps[0], skipSteps[1]) : 1);
  }

  for (let fi = 1; fi < fieldCount; fi++) {
    let values = Array(valueCount);

    for (let i = 0; i < valueCount; i++) {
      values[i] = Math.random() * 100;
    }

    allValues[fi] = values;
  }

  return {
    length: valueCount,
    fields: allValues.map((values, i) => {
      return {
        name: 'A-' + i,
        type: i === 0 ? FieldType.time : FieldType.number,
        config: {
          interval: i === 0 ? step : null,
        },
        values: new ArrayVector(values),
      };
    }),
  };
}

describe('nullInsertThreshold Transformer', () => {
  test('should insert nulls at +threshold between adjacent > threshold: 1', () => {
    const df = new MutableDataFrame({
      refId: 'A',
      fields: [
        { name: 'Time', type: FieldType.time, values: [1, 3, 10] },
        { name: 'One', type: FieldType.number, config: { custom: { insertNulls: 1 } }, values: [4, 6, 8] },
        { name: 'Two', type: FieldType.string, config: { custom: { insertNulls: 1 } }, values: ['a', 'b', 'c'] },
      ],
    });

    const result = applyNullInsertThreshold({ frame: df });

    expect(result.fields[0].values).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(result.fields[1].values).toEqual([4, null, 6, null, null, null, null, null, null, 8]);
    expect(result.fields[2].values).toEqual(['a', null, 'b', null, null, null, null, null, null, 'c']);
  });

  test('should insert nulls at +threshold between adjacent > threshold: 2', () => {
    const df = new MutableDataFrame({
      refId: 'A',
      fields: [
        { name: 'Time', type: FieldType.time, values: [5, 7, 11] },
        { name: 'One', type: FieldType.number, config: { custom: { insertNulls: 2 } }, values: [4, 6, 8] },
        { name: 'Two', type: FieldType.string, config: { custom: { insertNulls: 2 } }, values: ['a', 'b', 'c'] },
      ],
    });

    const result = applyNullInsertThreshold({ frame: df });

    expect(result.fields[0].values).toEqual([5, 7, 9, 11]);
    expect(result.fields[1].values).toEqual([4, 6, null, 8]);
    expect(result.fields[2].values).toEqual(['a', 'b', null, 'c']);
  });

  test('should insert nulls at +interval between adjacent > interval: 1', () => {
    const df = new MutableDataFrame({
      refId: 'A',
      fields: [
        { name: 'Time', type: FieldType.time, config: { interval: 1 }, values: [1, 3, 10] },
        { name: 'One', type: FieldType.number, values: [4, 6, 8] },
        { name: 'Two', type: FieldType.string, values: ['a', 'b', 'c'] },
      ],
    });

    const result = applyNullInsertThreshold({ frame: df });

    expect(result.fields[0].values).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(result.fields[1].values).toEqual([4, null, 6, null, null, null, null, null, null, 8]);
    expect(result.fields[2].values).toEqual(['a', null, 'b', null, null, null, null, null, null, 'c']);
  });

  test('should insert leading null at beginning +interval when timeRange.from.valueOf() exceeds threshold', () => {
    const df = new MutableDataFrame({
      refId: 'A',
      fields: [
        { name: 'Time', type: FieldType.time, config: { interval: 1 }, values: [4, 6, 13] },
        { name: 'One', type: FieldType.number, values: [4, 6, 8] },
        { name: 'Two', type: FieldType.string, values: ['a', 'b', 'c'] },
      ],
    });

    const result = applyNullInsertThreshold({
      frame: df,
      refFieldName: null,
      refFieldPseudoMin: -0.5,
      refFieldPseudoMax: 13,
    });

    expect(result.fields[0].values).toEqual([-1, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13]);
    expect(result.fields[1].values).toEqual([
      null,
      null,
      null,
      null,
      null,
      4,
      null,
      6,
      null,
      null,
      null,
      null,
      null,
      null,
      8,
    ]);
    expect(result.fields[2].values).toEqual([
      null,
      null,
      null,
      null,
      null,
      'a',
      null,
      'b',
      null,
      null,
      null,
      null,
      null,
      null,
      'c',
    ]);
  });

  test('should insert trailing null at end +interval when timeRange.to.valueOf() exceeds threshold', () => {
    const df = new MutableDataFrame({
      refId: 'A',
      fields: [
        { name: 'Time', type: FieldType.time, config: { interval: 1 }, values: [1, 3, 10] },
        { name: 'One', type: FieldType.number, values: [4, 6, 8] },
        { name: 'Two', type: FieldType.string, values: ['a', 'b', 'c'] },
      ],
    });

    const result = applyNullInsertThreshold({ frame: df, refFieldName: null, refFieldPseudoMax: 13 });

    expect(result.fields[0].values).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
    expect(result.fields[1].values).toEqual([4, null, 6, null, null, null, null, null, null, 8, null, null]);
    expect(result.fields[2].values).toEqual(['a', null, 'b', null, null, null, null, null, null, 'c', null, null]);

    // should work for frames with 1 datapoint
    const df2 = new MutableDataFrame({
      refId: 'A',
      fields: [
        { name: 'Time', type: FieldType.time, config: { interval: 1 }, values: [1] },
        { name: 'One', type: FieldType.number, values: [1] },
        { name: 'Two', type: FieldType.string, values: ['a'] },
      ],
    });

    // Max is 2.5 as opposed to the above 13 otherwise
    // we get 12 nulls instead of the additional 1
    const result2 = applyNullInsertThreshold({ frame: df2, refFieldName: null, refFieldPseudoMax: 2.5 });

    expect(result2.fields[0].values).toEqual([1, 2]);
    expect(result2.fields[1].values).toEqual([1, null]);
    expect(result2.fields[2].values).toEqual(['a', null]);
  });

  test('should not insert trailing null at end +interval when timeRange.to.valueOf() equals threshold', () => {
    const df = new MutableDataFrame({
      refId: 'A',
      fields: [
        { name: 'Time', type: FieldType.time, config: { interval: 1 }, values: [1] },
        { name: 'One', type: FieldType.number, values: [1] },
        { name: 'Two', type: FieldType.string, values: ['a'] },
      ],
    });

    const result = applyNullInsertThreshold({ frame: df, refFieldName: null, refFieldPseudoMax: 2 });

    expect(result.fields[0].values).toEqual([1]);
    expect(result.fields[1].values).toEqual([1]);
    expect(result.fields[2].values).toEqual(['a']);
  });

  // TODO: make this work
  test.skip('should insert nulls at +threshold (when defined) instead of +interval', () => {
    const df = new MutableDataFrame({
      refId: 'A',
      fields: [
        { name: 'Time', type: FieldType.time, config: { interval: 2 }, values: [5, 7, 11] },
        { name: 'One', type: FieldType.number, config: { custom: { insertNulls: 1 } }, values: [4, 6, 8] },
        { name: 'Two', type: FieldType.string, config: { custom: { insertNulls: 1 } }, values: ['a', 'b', 'c'] },
      ],
    });

    const result = applyNullInsertThreshold({ frame: df });

    expect(result.fields[0].values).toEqual([5, 6, 7, 8, 11]);
    expect(result.fields[1].values).toEqual([4, null, 6, null, 8]);
    expect(result.fields[2].values).toEqual(['a', null, 'b', null, 'c']);
  });

  test('should noop on 0 datapoints', () => {
    const df = new MutableDataFrame({
      refId: 'A',
      fields: [
        { name: 'Time', type: FieldType.time, config: { interval: 1 }, values: [] },
        { name: 'Value', type: FieldType.number, values: [] },
      ],
    });

    const result = applyNullInsertThreshold({ frame: df });

    expect(result).toBe(df);
  });

  test('should noop on invalid threshold', () => {
    const df = new MutableDataFrame({
      refId: 'A',
      fields: [
        { name: 'Time', type: FieldType.time, values: [1, 2, 4] },
        { name: 'Value', type: FieldType.number, config: { custom: { insertNulls: -1 } }, values: [1, 1, 1] },
      ],
    });

    const result = applyNullInsertThreshold({ frame: df });

    expect(result).toBe(df);
  });

  test('should noop on invalid interval', () => {
    const df = new MutableDataFrame({
      refId: 'A',
      fields: [
        { name: 'Time', type: FieldType.time, config: { interval: -1 }, values: [1, 2, 4] },
        { name: 'Value', type: FieldType.number, values: [1, 1, 1] },
      ],
    });

    const result = applyNullInsertThreshold({ frame: df });

    expect(result).toBe(df);
  });

  test('should noop when no missing steps', () => {
    const df = new MutableDataFrame({
      refId: 'A',
      fields: [
        { name: 'Time', type: FieldType.time, config: { interval: 1 }, values: [1, 2, 3] },
        { name: 'Value', type: FieldType.number, values: [1, 1, 1] },
      ],
    });

    const result = applyNullInsertThreshold({ frame: df });

    expect(result).toBe(df);
  });

  test('should noop when refFieldName not found', () => {
    const df = new MutableDataFrame({
      refId: 'A',
      fields: [
        { name: 'Time', type: FieldType.time, config: { interval: 1 }, values: [1, 2, 5] },
        { name: 'Value', type: FieldType.number, values: [1, 1, 1] },
      ],
    });

    const result = applyNullInsertThreshold({ frame: df, refFieldName: 'Time2' });

    expect(result).toBe(df);
  });

  // Leave this test skipped - it should be run manually
  test.skip('perf stress test should be <= 10ms', () => {
    // 10 fields x 3,000 values with 50% skip (output = 10 fields x 6,000 values)
    let bigFrameA = genFrame();

    // eslint-disable-next-line no-console
    console.time('insertValues-10x3k');
    applyNullInsertThreshold({ frame: bigFrameA });
    // eslint-disable-next-line no-console
    console.timeEnd('insertValues-10x3k');
  });
});
