import { DataFrameType, toDataFrame } from '@grafana/data';

import { isHeatmapSparse } from './utils';

describe('isHeatmapSparse', () => {
  it('should return false when heatmap is undefined', () => {
    expect(isHeatmapSparse(undefined)).toBe(false);
  });

  it('should return false for dense HeatmapCells (single Y field)', () => {
    const heatmap = toDataFrame({
      fields: [{ name: 'y', values: [] }],
      meta: { type: DataFrameType.HeatmapCells },
    });

    expect(isHeatmapSparse(heatmap)).toBe(false);
  });

  it('should return true for sparse HeatmapCells (yMin and yMax fields)', () => {
    const heatmap = toDataFrame({
      fields: [
        { name: 'yMin', values: [] },
        { name: 'yMax', values: [] },
      ],
      meta: { type: DataFrameType.HeatmapCells },
    });

    expect(isHeatmapSparse(heatmap)).toBe(true);
  });

  it('should return false for non-HeatmapCells data frames', () => {
    const heatmap = toDataFrame({
      fields: [{ name: 'Value', values: [] }],
      meta: { type: DataFrameType.HeatmapRows },
    });

    expect(isHeatmapSparse(heatmap)).toBe(false);
  });

  it('should return false when meta is undefined', () => {
    const heatmap = toDataFrame({
      fields: [{ name: 'value', values: [] }],
    });

    expect(isHeatmapSparse(heatmap)).toBe(false);
  });
});
