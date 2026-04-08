import { createDataFrame, FieldType } from '@grafana/data';

import { originalDataHasHistogram } from './utils';

describe('originalDataHasHistogram', () => {
  const validHistogramFrame = createDataFrame({
    fields: [
      { name: 'xMin', type: FieldType.number, values: [0, 1, 2] },
      { name: 'xMax', type: FieldType.number, values: [1, 2, 3] },
      { name: 'count', type: FieldType.number, values: [5, 10, 15] },
    ],
  });

  it('returns true for a single frame with xMin, xMax, and count fields (all number type)', () => {
    expect(originalDataHasHistogram([validHistogramFrame])).toBe(true);
  });

  it('returns true when first field is BucketMin and second is BucketMax', () => {
    const frame = createDataFrame({
      fields: [
        { name: 'BucketMin', type: FieldType.number, values: [0, 1] },
        { name: 'BucketMax', type: FieldType.number, values: [1, 2] },
        { name: 'count', type: FieldType.number, values: [5, 10] },
      ],
    });
    expect(originalDataHasHistogram([frame])).toBe(true);
  });

  it('returns false when frames is undefined', () => {
    expect(originalDataHasHistogram(undefined)).toBe(false);
  });

  it('returns false when frames is empty', () => {
    expect(originalDataHasHistogram([])).toBe(false);
  });

  it('returns false when frames has more than one frame', () => {
    expect(originalDataHasHistogram([validHistogramFrame, validHistogramFrame])).toBe(false);
  });

  it('returns false when frame has fewer than 3 fields', () => {
    const twoFieldFrame = createDataFrame({
      fields: [
        { name: 'xMin', type: FieldType.number, values: [0, 1] },
        { name: 'xMax', type: FieldType.number, values: [1, 2] },
      ],
    });
    expect(originalDataHasHistogram([twoFieldFrame])).toBe(false);
  });

  it('returns false when first field is not a bucket min field name', () => {
    const frame = createDataFrame({
      fields: [
        { name: 'wrongName', type: FieldType.number, values: [0, 1] },
        { name: 'xMax', type: FieldType.number, values: [1, 2] },
        { name: 'count', type: FieldType.number, values: [5, 10] },
      ],
    });
    expect(originalDataHasHistogram([frame])).toBe(false);
  });

  it('returns false when second field is not a bucket max field name', () => {
    const frame = createDataFrame({
      fields: [
        { name: 'xMin', type: FieldType.number, values: [0, 1] },
        { name: 'wrongName', type: FieldType.number, values: [1, 2] },
        { name: 'count', type: FieldType.number, values: [5, 10] },
      ],
    });
    expect(originalDataHasHistogram([frame])).toBe(false);
  });

  it('returns false when any field has non-number type', () => {
    const frame = createDataFrame({
      fields: [
        { name: 'xMin', type: FieldType.number, values: [0, 1] },
        { name: 'xMax', type: FieldType.number, values: [1, 2] },
        { name: 'count', type: FieldType.string, values: ['5', '10'] },
      ],
    });
    expect(originalDataHasHistogram([frame])).toBe(false);
  });

  it('returns false when first field has non-number type', () => {
    const frame = createDataFrame({
      fields: [
        { name: 'xMin', type: FieldType.string, values: ['0', '1'] },
        { name: 'xMax', type: FieldType.number, values: [1, 2] },
        { name: 'count', type: FieldType.number, values: [5, 10] },
      ],
    });
    expect(originalDataHasHistogram([frame])).toBe(false);
  });
});
