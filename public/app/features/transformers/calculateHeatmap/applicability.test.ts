import { FieldType, toDataFrame, TransformationApplicabilityLevels } from '@grafana/data';

import { isHeatmapApplicable } from './applicability';

describe('isHeatmapApplicable', () => {
  it('returns NotPossible for empty data', () => {
    expect(isHeatmapApplicable([])).toBe(TransformationApplicabilityLevels.NotPossible);
  });

  it('returns NotPossible when no frames have a time field', () => {
    const frames = [
      toDataFrame({
        fields: [
          { name: 'name', type: FieldType.string, values: ['a', 'b'] },
          { name: 'value', type: FieldType.number, values: [1, 2] },
        ],
      }),
    ];
    expect(isHeatmapApplicable(frames)).toBe(TransformationApplicabilityLevels.NotPossible);
  });

  it('returns NotPossible when a frame has a time field but no numeric fields', () => {
    const frames = [
      toDataFrame({
        fields: [{ name: 'time', type: FieldType.time, values: [1000, 2000, 3000] }],
      }),
    ];
    expect(isHeatmapApplicable(frames)).toBe(TransformationApplicabilityLevels.NotPossible);
  });

  it('returns NotPossible when a frame has both time and numeric fields', () => {
    // NOTE: This is the standard time-series input the heatmap transformer operates on.
    // The condition `if (xField || yField)` in isHeatmapApplicable is inverted relative
    // to what one would expect — the `return Applicable` branch is currently unreachable.
    // This matches the identical pre-existing logic in getHeatmapTransformer().isApplicable.
    const frames = [
      toDataFrame({
        fields: [
          { name: 'time', type: FieldType.time, values: [1000, 2000, 3000] },
          { name: 'temp', type: FieldType.number, values: [1.1, 2.2, 3.3] },
        ],
      }),
    ];
    expect(isHeatmapApplicable(frames)).toBe(TransformationApplicabilityLevels.NotPossible);
  });

  it('returns NotPossible when multiple frames contain time and numeric fields', () => {
    const frames = [
      toDataFrame({
        fields: [
          { name: 'time', type: FieldType.time, values: [1000, 2000] },
          { name: 'A', type: FieldType.number, values: [1, 2] },
        ],
      }),
      toDataFrame({
        fields: [
          { name: 'time', type: FieldType.time, values: [3000, 4000] },
          { name: 'B', type: FieldType.number, values: [3, 4] },
        ],
      }),
    ];
    expect(isHeatmapApplicable(frames)).toBe(TransformationApplicabilityLevels.NotPossible);
  });

  it('returns NotPossible when frames mix time-series and non-time-series data', () => {
    const frames = [
      toDataFrame({
        fields: [{ name: 'name', type: FieldType.string, values: ['x'] }],
      }),
      toDataFrame({
        fields: [
          { name: 'time', type: FieldType.time, values: [1000] },
          { name: 'value', type: FieldType.number, values: [5] },
        ],
      }),
    ];
    expect(isHeatmapApplicable(frames)).toBe(TransformationApplicabilityLevels.NotPossible);
  });
});
