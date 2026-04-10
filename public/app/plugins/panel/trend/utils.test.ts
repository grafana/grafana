import { FieldType, toDataFrame } from '@grafana/data';
import { ScaleDistribution } from '@grafana/schema';

import { findXFieldIndex, prepSeries } from './utils';

describe('findXFieldIndex', () => {
  it('returns first number field when 2+ number fields exist', () => {
    const frame = toDataFrame({
      fields: [
        { name: 'x', type: FieldType.number, values: [1, 2, 3] },
        { name: 'y', type: FieldType.number, values: [4, 5, 6] },
      ],
    });
    expect(findXFieldIndex(frame.fields)).toBe(0);
  });

  it('prefers string over numbers when no time field (primary categorical use case)', () => {
    const frame = toDataFrame({
      fields: [
        { name: 'category', type: FieldType.string, values: ['a', 'b', 'c'] },
        { name: 'sales', type: FieldType.number, values: [1, 2, 3] },
        { name: 'revenue', type: FieldType.number, values: [4, 5, 6] },
      ],
    });
    expect(findXFieldIndex(frame.fields)).toBe(0);
  });

  it('does not prefer string over number when time field is present', () => {
    const frame = toDataFrame({
      fields: [
        { name: 'time', type: FieldType.time, values: [1000, 2000, 3000] },
        { name: 'host', type: FieldType.string, values: ['a', 'b', 'c'] },
        { name: 'cpu', type: FieldType.number, values: [1, 2, 3] },
      ],
    });
    // Should pick the number field, not the string — time is the natural X
    expect(findXFieldIndex(frame.fields)).toBe(2);
  });

  it('picks string over sole number when no time field exists', () => {
    const frame = toDataFrame({
      fields: [
        { name: 'label', type: FieldType.string, values: ['a', 'b', 'c'] },
        { name: 'value', type: FieldType.number, values: [1, 2, 3] },
      ],
    });
    expect(findXFieldIndex(frame.fields)).toBe(0);
  });

  it('falls back to number field when no string field exists', () => {
    const frame = toDataFrame({
      fields: [{ name: 'x', type: FieldType.number, values: [1, 2, 3] }],
    });
    expect(findXFieldIndex(frame.fields)).toBe(0);
  });

  it('returns -1 when no suitable fields exist', () => {
    const frame = toDataFrame({
      fields: [{ name: 'time', type: FieldType.time, values: [1000, 2000] }],
    });
    expect(findXFieldIndex(frame.fields)).toBe(-1);
  });

  it('ignores string field even when it precedes the time field, when time is present', () => {
    const frame = toDataFrame({
      fields: [
        { name: 'host', type: FieldType.string, values: ['a', 'b', 'c'] },
        { name: 'time', type: FieldType.time, values: [1000, 2000, 3000] },
        { name: 'cpu', type: FieldType.number, values: [1, 2, 3] },
      ],
    });
    // String is at index 0, but time is present — should still return the number field
    expect(findXFieldIndex(frame.fields)).toBe(2);
  });

  it('picks string over sole number even when string is not first', () => {
    const frame = toDataFrame({
      fields: [
        { name: 'value', type: FieldType.number, values: [1, 2, 3] },
        { name: 'label', type: FieldType.string, values: ['a', 'b', 'c'] },
      ],
    });
    expect(findXFieldIndex(frame.fields)).toBe(1);
  });
});

describe('prepSeries', () => {
  it('returns warning for multiple frames', () => {
    const frames = [
      toDataFrame({ fields: [{ name: 'a', values: [1] }] }),
      toDataFrame({ fields: [{ name: 'b', values: [2] }] }),
    ];
    const result = prepSeries(frames);
    expect(result.warning).toContain('Only one frame');
  });

  it('returns warning when xField is not found', () => {
    const frames = [
      toDataFrame({
        fields: [{ name: 'a', type: FieldType.number, values: [1, 2] }],
      }),
    ];
    const result = prepSeries(frames, 'nonexistent');
    expect(result.warning).toContain('Unable to find field');
  });

  it('returns warning for non-ascending numeric X', () => {
    const frames = [
      toDataFrame({
        fields: [
          { name: 'x', type: FieldType.number, values: [3, 1, 2] },
          { name: 'y', type: FieldType.number, values: [4, 5, 6] },
        ],
      }),
    ];
    const result = prepSeries(frames);
    expect(result.warning).toContain('ascending order');
  });

  it('creates synthetic numeric field for string X', () => {
    const frames = [
      toDataFrame({
        fields: [
          { name: 'batch', type: FieldType.string, values: ['A', 'B', 'C'] },
          { name: 'yield', type: FieldType.number, values: [10, 20, 30] },
        ],
      }),
    ];
    const result = prepSeries(frames);
    expect(result.warning).toBeUndefined();
    expect(result.frames).not.toBeNull();

    // The X field should be converted to a numeric field with index values
    const xField = result.frames![0].fields.find((f) => f.name === 'batch');
    expect(xField).toBeDefined();
    expect(xField!.type).toBe(FieldType.number);
    expect(xField!.values).toEqual([0, 1, 2]);
  });

  it('sets ordinal scale distribution on synthetic field', () => {
    const frames = [
      toDataFrame({
        fields: [
          { name: 'batch', type: FieldType.string, values: ['A', 'B', 'C'] },
          { name: 'yield', type: FieldType.number, values: [10, 20, 30] },
        ],
      }),
    ];
    const result = prepSeries(frames);
    const xField = result.frames![0].fields.find((f) => f.name === 'batch');
    expect(xField!.config.custom?.scaleDistribution?.type).toBe(ScaleDistribution.Ordinal);
  });

  it('sets min/max with padding on synthetic field', () => {
    const frames = [
      toDataFrame({
        fields: [
          { name: 'batch', type: FieldType.string, values: ['A', 'B', 'C'] },
          { name: 'yield', type: FieldType.number, values: [10, 20, 30] },
        ],
      }),
    ];
    const result = prepSeries(frames);
    const xField = result.frames![0].fields.find((f) => f.name === 'batch');
    expect(xField!.config.min).toBe(-0.5);
    expect(xField!.config.max).toBe(2.5);
  });

  it('display processor maps indices to original string labels', () => {
    const frames = [
      toDataFrame({
        fields: [
          { name: 'batch', type: FieldType.string, values: ['Alpha', 'Beta', 'Gamma'] },
          { name: 'yield', type: FieldType.number, values: [10, 20, 30] },
        ],
      }),
    ];
    const result = prepSeries(frames);
    const xField = result.frames![0].fields.find((f) => f.name === 'batch');

    expect(xField!.display!(0)).toMatchObject({ text: 'Alpha' });
    expect(xField!.display!(1)).toMatchObject({ text: 'Beta' });
    expect(xField!.display!(2)).toMatchObject({ text: 'Gamma' });
  });

  it('display processor rounds fractional indices to nearest label', () => {
    const frames = [
      toDataFrame({
        fields: [
          { name: 'batch', type: FieldType.string, values: ['A', 'B', 'C'] },
          { name: 'yield', type: FieldType.number, values: [10, 20, 30] },
        ],
      }),
    ];
    const result = prepSeries(frames);
    const xField = result.frames![0].fields.find((f) => f.name === 'batch');

    expect(xField!.display!(0.4)).toMatchObject({ text: 'A' });
    expect(xField!.display!(1.4)).toMatchObject({ text: 'B' });
    expect(xField!.display!(1.6)).toMatchObject({ text: 'C' });
  });

  it('display processor clamps out-of-bounds indices', () => {
    const frames = [
      toDataFrame({
        fields: [
          { name: 'batch', type: FieldType.string, values: ['A', 'B', 'C'] },
          { name: 'yield', type: FieldType.number, values: [10, 20, 30] },
        ],
      }),
    ];
    const result = prepSeries(frames);
    const xField = result.frames![0].fields.find((f) => f.name === 'batch');

    // Negative (from -0.5 padding)
    expect(xField!.display!(-0.5)).toMatchObject({ text: 'A' });
    expect(xField!.display!(-1)).toMatchObject({ text: 'A' });
    // Beyond end (from max padding)
    expect(xField!.display!(2.5)).toMatchObject({ text: 'C' });
    expect(xField!.display!(99)).toMatchObject({ text: 'C' });
  });

  it('skips ascending check for string X fields', () => {
    // String values in non-alphabetical order should still work
    const frames = [
      toDataFrame({
        fields: [
          { name: 'batch', type: FieldType.string, values: ['Z', 'A', 'M'] },
          { name: 'yield', type: FieldType.number, values: [10, 20, 30] },
        ],
      }),
    ];
    const result = prepSeries(frames);
    expect(result.warning).toBeUndefined();
    expect(result.frames).not.toBeNull();
  });

  it('works with explicit xField pointing to a string field', () => {
    const frames = [
      toDataFrame({
        fields: [
          { name: 'batch', type: FieldType.string, values: ['A', 'B'] },
          { name: 'yield', type: FieldType.number, values: [10, 20] },
        ],
      }),
    ];
    const result = prepSeries(frames, 'batch');
    expect(result.warning).toBeUndefined();
    expect(result.frames).not.toBeNull();
  });

  it('display processor handles NaN and undefined gracefully', () => {
    const frames = [
      toDataFrame({
        fields: [
          { name: 'batch', type: FieldType.string, values: ['A', 'B'] },
          { name: 'yield', type: FieldType.number, values: [10, 20] },
        ],
      }),
    ];
    const result = prepSeries(frames);
    const xField = result.frames![0].fields.find((f) => f.name === 'batch');

    expect(xField!.display!(NaN)).toMatchObject({ text: '', numeric: 0 });
    expect(xField!.display!(null)).toMatchObject({ text: '', numeric: 0 });
    expect(xField!.display!(undefined)).toMatchObject({ text: '', numeric: 0 });
  });

  it('works with a single data point', () => {
    const frames = [
      toDataFrame({
        fields: [
          { name: 'batch', type: FieldType.string, values: ['Only'] },
          { name: 'yield', type: FieldType.number, values: [42] },
        ],
      }),
    ];
    const result = prepSeries(frames);
    expect(result.warning).toBeUndefined();
    expect(result.frames).not.toBeNull();

    const xField = result.frames![0].fields.find((f) => f.name === 'batch');
    expect(xField!.display!(0)).toMatchObject({ text: 'Only' });
  });

  it('handles null values in string field', () => {
    const frames = [
      toDataFrame({
        fields: [
          { name: 'batch', type: FieldType.string, values: ['A', null, 'C'] },
          { name: 'yield', type: FieldType.number, values: [10, 20, 30] },
        ],
      }),
    ];
    const result = prepSeries(frames);
    expect(result.warning).toBeUndefined();
    expect(result.frames).not.toBeNull();
  });

  it('handles duplicate string labels', () => {
    const frames = [
      toDataFrame({
        fields: [
          { name: 'batch', type: FieldType.string, values: ['A', 'A', 'B'] },
          { name: 'yield', type: FieldType.number, values: [10, 20, 30] },
        ],
      }),
    ];
    const result = prepSeries(frames);
    expect(result.warning).toBeUndefined();
    expect(result.frames).not.toBeNull();
    const xField = result.frames![0].fields.find((f) => f.name === 'batch');
    expect(xField!.display!(0)).toMatchObject({ text: 'A' });
    expect(xField!.display!(1)).toMatchObject({ text: 'A' });
    expect(xField!.display!(2)).toMatchObject({ text: 'B' });
  });

  it('handles numeric-looking strings', () => {
    const frames = [
      toDataFrame({
        fields: [
          { name: 'id', type: FieldType.string, values: ['100', '200', '300'] },
          { name: 'value', type: FieldType.number, values: [1, 2, 3] },
        ],
      }),
    ];
    const result = prepSeries(frames);
    const xField = result.frames![0].fields.find((f) => f.name === 'id');
    expect(xField!.display!(0)).toMatchObject({ text: '100' });
    expect(xField!.display!(1)).toMatchObject({ text: '200' });
  });

  it('returns warning for empty frames', () => {
    const result = prepSeries([toDataFrame({ fields: [] })]);
    expect(result.warning).toBeDefined();
  });

  it('preserves original behavior for ascending numeric X with 2+ number fields', () => {
    const frames = [
      toDataFrame({
        fields: [
          { name: 'x', type: FieldType.number, values: [1, 2, 3] },
          { name: 'y', type: FieldType.number, values: [10, 20, 30] },
        ],
      }),
    ];
    const result = prepSeries(frames);
    expect(result.warning).toBeUndefined();
    expect(result.frames).not.toBeNull();
  });
});
