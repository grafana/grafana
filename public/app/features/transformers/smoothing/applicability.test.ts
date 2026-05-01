import { FieldType, toDataFrame, TransformationApplicabilityLevels } from '@grafana/data';

import { isSmoothingApplicable } from './applicability';

describe('isSmoothingApplicable', () => {
  it('returns NotApplicable for empty data', () => {
    expect(isSmoothingApplicable([])).toBe(TransformationApplicabilityLevels.NotApplicable);
  });

  it('returns NotApplicable when no frames are time series', () => {
    const frames = [
      toDataFrame({
        fields: [
          { name: 'name', type: FieldType.string, values: ['a', 'b'] },
          { name: 'value', type: FieldType.number, values: [1, 2] },
        ],
      }),
    ];
    expect(isSmoothingApplicable(frames)).toBe(TransformationApplicabilityLevels.NotApplicable);
  });

  it('returns Applicable when at least one frame is a time series', () => {
    const frames = [
      toDataFrame({
        fields: [
          { name: 'time', type: FieldType.time, values: [1000, 2000, 3000] },
          { name: 'value', type: FieldType.number, values: [10, 20, 15] },
        ],
      }),
    ];
    expect(isSmoothingApplicable(frames)).toBe(TransformationApplicabilityLevels.Applicable);
  });

  it('returns Applicable when at least one of multiple frames is a time series', () => {
    const frames = [
      toDataFrame({
        fields: [
          { name: 'name', type: FieldType.string, values: ['a', 'b'] },
          { name: 'value', type: FieldType.number, values: [1, 2] },
        ],
      }),
      toDataFrame({
        fields: [
          { name: 'time', type: FieldType.time, values: [1000, 2000] },
          { name: 'value', type: FieldType.number, values: [5, 10] },
        ],
      }),
    ];
    expect(isSmoothingApplicable(frames)).toBe(TransformationApplicabilityLevels.Applicable);
  });
});
