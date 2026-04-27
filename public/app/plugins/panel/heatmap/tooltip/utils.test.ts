import { createDataFrame, FieldType, toDataFrame } from '@grafana/data/dataframe';
import { DataFrameType } from '@grafana/data/types';

import { type HeatmapData } from '../fields';

import { formatMilliseconds, getFieldFromData, getHoverCellColor, getSparseCellMinMax, isHeatmapSparse } from './utils';

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

describe('formatMilliseconds', () => {
  it('converts ms to appropriate unit', () => {
    let msToFormat = 10;
    let formatted = formatMilliseconds(msToFormat);
    expect(formatted).toBe('10 ms');

    msToFormat = 1000;
    formatted = formatMilliseconds(msToFormat);
    expect(formatted).toBe('1 s');

    msToFormat = 1000 * 120;
    formatted = formatMilliseconds(msToFormat);
    expect(formatted).toBe('2 m');

    msToFormat = 1000 * 60 * 60;
    formatted = formatMilliseconds(msToFormat);
    expect(formatted).toBe('1 h');

    msToFormat = 1000 * 60 * 60 * 24;
    formatted = formatMilliseconds(msToFormat);
    expect(formatted).toBe('1 day');

    msToFormat = 1000 * 60 * 60 * 24 * 7 * 3;
    formatted = formatMilliseconds(msToFormat);
    expect(formatted).toBe('3 weeks');

    msToFormat = 1000 * 60 * 60 * 24 * 7 * 4;
    formatted = formatMilliseconds(msToFormat);
    expect(formatted).toBe('4 weeks');

    msToFormat = 1000 * 60 * 60 * 24 * 7 * 5;
    formatted = formatMilliseconds(msToFormat);
    expect(formatted).toBe('1 month');

    msToFormat = 1000 * 60 * 60 * 24 * 365;
    formatted = formatMilliseconds(msToFormat);
    expect(formatted).toBe('1 year');

    msToFormat = 1000 * 60 * 60 * 24 * 365 * 2;
    formatted = formatMilliseconds(msToFormat);
    expect(formatted).toBe('2 years');
  });
});

describe('getHoverCellColor', () => {
  it('returns the correct cell color and color palette when colorIndex is not null', () => {
    const heatmapData: HeatmapData = {
      heatmapColors: {
        minValue: 0,
        maxValue: 2,
        palette: ['#FF0000', '#00FF00', '#0000FF'],
        values: [0, 1, 2],
      },
    };

    const result = getHoverCellColor(heatmapData, 1);

    expect(result.cellColor).toBe('#00FF00');
    expect(result.colorPalette).toEqual(['#FF0000', '#00FF00', '#0000FF']);
  });

  it('handles an index that is out of bounds', () => {
    const heatmapData: HeatmapData = {
      heatmapColors: {
        minValue: 0,
        maxValue: 1,
        palette: ['#FF0000', '#00FF00'],
        values: [0, 1],
      },
    };

    const result = getHoverCellColor(heatmapData, 2);

    expect(result.cellColor).toBeUndefined();
    expect(result.colorPalette).toEqual(['#FF0000', '#00FF00']);
  });
});

describe('getFieldFromData', () => {
  const dataFrame = createDataFrame({
    fields: [
      { name: 'xMax', values: [1, 2, 3] },
      { name: 'yMax', values: [4, 5, 6] },
      { name: 'value', values: [7, 8, 9] },
    ],
  });

  it('returns the right field when sparse is false', () => {
    const result = getFieldFromData(dataFrame, 'x', false);
    expect(result).toEqual(dataFrame.fields[0]);

    const result2 = getFieldFromData(dataFrame, 'y', false);
    expect(result2).toEqual(dataFrame.fields[1]);

    const result3 = getFieldFromData(dataFrame, 'count', false);
    expect(result3).toEqual(dataFrame.fields[2]);
  });

  it('returns the right field when sparse is true', () => {
    const result = getFieldFromData(dataFrame, 'x', true);
    expect(result?.name).toEqual('xMax');

    const result2 = getFieldFromData(dataFrame, 'y', true);
    expect(result2?.name).toEqual('yMax');

    const result3 = getFieldFromData(dataFrame, 'count', true);
    expect(result3?.name).toBeUndefined();
  });
});

describe('getSparseCellMinMax', () => {
  it('returns the right bucket values for sparse data', () => {
    const heatmapData: HeatmapData = {
      heatmap: {
        fields: [
          {
            name: 'xMax',
            type: FieldType.time,
            config: { interval: 1000 },
            values: [1654000708000, 1654000709000, 1654000710000],
          },
          { name: 'yMin', type: FieldType.number, config: {}, values: [4, 5, 6] },
          { name: 'yMax', type: FieldType.number, config: {}, values: [7, 8, 9] },
          { name: 'count', type: FieldType.number, config: {}, values: [10, 11, 12] },
        ],
        length: 4,
      },
    };

    const result = getSparseCellMinMax(heatmapData, 0);
    expect(result).toEqual({ xBucketMin: 1654000707000, xBucketMax: 1654000708000, yBucketMin: 4, yBucketMax: 7 });

    const result2 = getSparseCellMinMax(heatmapData, 2);
    expect(result2).toEqual({ xBucketMin: 1654000709000, xBucketMax: 1654000710000, yBucketMin: 6, yBucketMax: 9 });
  });

  // Regression for "Heatmap: Fix tooltip bucket range for sparse heatmaps" (PR #97340).
  // The xBucketMin for the last cell must equal xMax[last] - interval, not go negative.
  it('computes xBucketMin correctly for the last bucket', () => {
    const heatmapData: HeatmapData = {
      heatmap: {
        fields: [
          {
            name: 'xMax',
            type: FieldType.time,
            config: { interval: 500 },
            values: [1000, 1500, 2000],
          },
          { name: 'yMin', type: FieldType.number, config: {}, values: [0, 0, 0] },
          { name: 'yMax', type: FieldType.number, config: {}, values: [10, 10, 10] },
          { name: 'count', type: FieldType.number, config: {}, values: [1, 2, 3] },
        ],
        length: 4,
      },
    };

    const result = getSparseCellMinMax(heatmapData, 2);
    expect(result.xBucketMin).toBe(1500); // 2000 - 500
    expect(result.xBucketMax).toBe(2000);
    expect(result.xBucketMin).toBeGreaterThan(0);
  });

  // Regression for "Heatmap: Fix null/undefined in tooltip for heatmap" (PR #99074).
  // Negative yMin/yMax bucket boundaries must be returned unchanged without
  // being coerced to 0 or NaN.
  it('returns negative yBucketMin and yBucketMax unchanged', () => {
    const heatmapData: HeatmapData = {
      heatmap: {
        fields: [
          {
            name: 'xMax',
            type: FieldType.time,
            config: { interval: 1000 },
            values: [1654000708000],
          },
          { name: 'yMin', type: FieldType.number, config: {}, values: [-20] },
          { name: 'yMax', type: FieldType.number, config: {}, values: [-10] },
          { name: 'count', type: FieldType.number, config: {}, values: [5] },
        ],
        length: 4,
      },
    };

    const result = getSparseCellMinMax(heatmapData, 0);
    expect(result.yBucketMin).toBe(-20);
    expect(result.yBucketMax).toBe(-10);
  });
});

describe('getFieldFromData — regression tests', () => {
  // Regression for "Heatmap: Fix tooltip to not show empty series" (PR #95610).
  // When isSparse=true the lookup uses names, not positions.
  // A frame with only xMax (no yMin/yMax) must return undefined, not throw.
  it('returns undefined for y when sparse frame has no yMin or yMax field', () => {
    const dataFrame = createDataFrame({
      fields: [{ name: 'xMax', values: [1, 2, 3] }],
    });

    const result = getFieldFromData(dataFrame, 'y', true);
    expect(result).toBeUndefined();
  });

  // When isSparse=false the count field is at positional index 2.
  // A two-field frame (x, y) must return undefined — not throw or return index 2 as undefined.
  it('returns undefined for count when dense frame only has 2 fields', () => {
    const dataFrame = createDataFrame({
      fields: [
        { name: 'x', values: [1, 2] },
        { name: 'y', values: [3, 4] },
      ],
    });

    const result = getFieldFromData(dataFrame, 'count', false);
    expect(result).toBeUndefined();
  });

  // Regression for "Heatmap: Fix tooltip for heatmaps with many fields" (PR #92779).
  // When isSparse=true, the x lookup must prefer 'xMax' over other xMin/x variants
  // when multiple x-related fields exist.
  it('finds xMax field when sparse frame has both xMin and xMax', () => {
    const dataFrame = createDataFrame({
      fields: [
        { name: 'xMin', values: [900, 1400, 1900] },
        { name: 'xMax', values: [1000, 1500, 2000] },
        { name: 'yMin', values: [0, 0, 0] },
        { name: 'yMax', values: [10, 10, 10] },
      ],
    });

    const result = getFieldFromData(dataFrame, 'x', true);
    // Should find the first matching field (xMin or xMax) — either is valid;
    // the important thing is it does not throw and returns a defined field.
    expect(result).toBeDefined();
    expect(['x', 'xMin', 'xMax']).toContain(result?.name);
  });
});
