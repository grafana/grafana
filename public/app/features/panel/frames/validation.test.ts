import { FieldType, createDataFrame } from '@grafana/data';

import { findFrameWithNullTimeValue } from './validation';

describe('findFrameWithNullTimeValue', () => {
  const cleanFrame = createDataFrame({
    fields: [
      { name: 'time', type: FieldType.time, values: [1000, 2000] },
      { name: 'value', type: FieldType.number, values: [1, 2] },
    ],
  });

  const nullTimeFrame = createDataFrame({
    refId: 'A',
    fields: [
      { name: 'time', type: FieldType.time, values: [1000, null] },
      { name: 'value', type: FieldType.number, values: [1, 2] },
    ],
  });

  it('returns undefined when every time field is fully populated', () => {
    expect(findFrameWithNullTimeValue([cleanFrame])).toBeUndefined();
  });

  it('returns the frame whose time field contains a null', () => {
    expect(findFrameWithNullTimeValue([nullTimeFrame])).toBe(nullTimeFrame);
  });

  it('finds the offending frame among several frames', () => {
    expect(findFrameWithNullTimeValue([cleanFrame, nullTimeFrame])).toBe(nullTimeFrame);
  });

  it('ignores nulls in non-time fields', () => {
    const nullValueFrame = createDataFrame({
      fields: [
        { name: 'time', type: FieldType.time, values: [1000, 2000] },
        { name: 'value', type: FieldType.number, values: [1, null] },
      ],
    });
    expect(findFrameWithNullTimeValue([nullValueFrame])).toBeUndefined();
  });

  it('ignores frames without a time field (missing-field handling stays with the panel)', () => {
    const noTimeFrame = createDataFrame({
      fields: [{ name: 'value', type: FieldType.number, values: [1, null] }],
    });
    expect(findFrameWithNullTimeValue([noTimeFrame])).toBeUndefined();
  });

  it('returns undefined for an empty frame list', () => {
    expect(findFrameWithNullTimeValue([])).toBeUndefined();
  });
});
