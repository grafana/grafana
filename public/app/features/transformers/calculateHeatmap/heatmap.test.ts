import { FieldType, toDataFrame } from '@grafana/data';
import { HeatmapCalculationOptions, HeatmapCellLayout, ScaleDistribution } from '@grafana/schema';

import { rowsToCellsHeatmap, calculateHeatmapFromData, calculateBucketFactor } from './heatmap';

describe('Heatmap transformer', () => {
  it('calculate heatmap from input data', async () => {
    const options: HeatmapCalculationOptions = {
      //
    };

    const data = toDataFrame({
      fields: [
        { name: 'time', type: FieldType.time, values: [1, 2, 3, 4] },
        { name: 'temp', type: FieldType.number, config: { unit: 'm2' }, values: [1.1, 2.2, 3.3, 4.4] },
      ],
    });

    const heatmap = calculateHeatmapFromData([data], options);
    expect(heatmap.fields.map((f) => ({ name: f.name, type: f.type, config: f.config }))).toMatchInlineSnapshot(`
      [
        {
          "config": {},
          "name": "xMin",
          "type": "time",
        },
        {
          "config": {
            "custom": {
              "scaleDistribution": {
                "type": "linear",
              },
            },
            "unit": "m2",
          },
          "name": "yMin",
          "type": "number",
        },
        {
          "config": {
            "unit": "short",
          },
          "name": "Count",
          "type": "number",
        },
      ]
    `);
  });

  it('convert heatmap buckets to scanlines', async () => {
    const frame = toDataFrame({
      fields: [
        { name: 'time', type: FieldType.time, values: [1, 2, 3] },
        { name: 'A', type: FieldType.number, config: { unit: 'm2' }, values: [1.1, 1.2, 1.3] },
        { name: 'B', type: FieldType.number, config: { unit: 'm2' }, values: [2.1, 2.2, 2.3] },
        { name: 'C', type: FieldType.number, config: { unit: 'm2' }, values: [3.1, 3.2, 3.3] },
      ],
    });

    const heatmap = rowsToCellsHeatmap({ frame, value: 'Speed' });
    expect(heatmap.fields.map((f) => ({ name: f.name, type: f.type, config: f.config }))).toMatchInlineSnapshot(`
      [
        {
          "config": {},
          "name": "xMax",
          "type": "time",
        },
        {
          "config": {
            "unit": "short",
          },
          "name": "y",
          "type": "number",
        },
        {
          "config": {
            "unit": "m2",
          },
          "name": "Speed",
          "type": "number",
        },
      ]
    `);
    expect(heatmap.meta).toMatchInlineSnapshot(`
      {
        "custom": {
          "yMatchWithLabel": undefined,
          "yOrdinalDisplay": [
            "A",
            "B",
            "C",
          ],
        },
        "type": "heatmap-cells",
      }
    `);
    expect(heatmap.fields[1].values).toMatchInlineSnapshot(`
      [
        0,
        1,
        2,
        0,
        1,
        2,
        0,
        1,
        2,
      ]
    `);
  });

  it('throws error if no numeric fields are present', async () => {
    expect(() =>
      rowsToCellsHeatmap({
        frame: toDataFrame({
          fields: [
            { name: 'time', type: FieldType.time, values: [1, 2, 3, 4] },
            { name: 'label', type: FieldType.string, values: ['a', 'b', 'c', 'd'] },
          ],
        }),
      })
    ).toThrowErrorMatchingInlineSnapshot(`"No numeric fields found for heatmap"`);
  });

  describe('calculateBucketFactor', () => {
    it('calculates ratio from last two buckets for log2 spacing', () => {
      const buckets = [1, 2, 4, 8];
      expect(calculateBucketFactor(buckets)).toBe(2);
    });

    it('calculates ratio from last two buckets for log10 spacing', () => {
      const buckets = [1, 10, 100, 1000];
      expect(calculateBucketFactor(buckets)).toBe(10);
    });

    it('calculates ratio for non-uniform spacing', () => {
      const buckets = [1, 2.5, 6.25];
      expect(calculateBucketFactor(buckets)).toBe(2.5);
    });

    it('returns default factor for single value array', () => {
      expect(calculateBucketFactor([5])).toBe(1.5);
    });

    it('returns default factor for empty array', () => {
      expect(calculateBucketFactor([])).toBe(1.5);
    });

    it('returns default factor when ratio is not valid expansion (<=1)', () => {
      const buckets = [10, 5]; // Descending
      expect(calculateBucketFactor(buckets)).toBe(1.5);
    });

    it('returns default factor when ratio contains zero', () => {
      const buckets = [0, 5];
      expect(calculateBucketFactor(buckets)).toBe(1.5);
    });

    it('returns default factor when ratio is infinite', () => {
      const buckets = [5, Infinity];
      expect(calculateBucketFactor(buckets)).toBe(1.5);
    });

    it('accepts custom default factor', () => {
      expect(calculateBucketFactor([5], 3)).toBe(3);
    });
  });

  describe('rowsToCellsHeatmap with linear scale', () => {
    it('converts prometheus-style le labels to numeric buckets with linear scale', () => {
      const frame = toDataFrame({
        fields: [
          { name: 'time', type: FieldType.time, values: [1000, 2000] },
          {
            name: '1',
            type: FieldType.number,
            labels: { le: '1' },
            values: [10, 15],
          },
          {
            name: '10',
            type: FieldType.number,
            labels: { le: '10' },
            values: [20, 25],
          },
          {
            name: '100',
            type: FieldType.number,
            labels: { le: '100' },
            values: [30, 35],
          },
        ],
      });

      const heatmap = rowsToCellsHeatmap({
        frame,
        yBucketScale: { type: ScaleDistribution.Linear },
      });

      // Should use numeric values [1, 10, 100] instead of ordinal indices [0, 1, 2]
      expect(heatmap.fields[1].values).toEqual([1, 10, 100, 1, 10, 100]);
      expect(heatmap.fields[1].name).toBe('yMax'); // le layout
    });

    it('converts ge labels to numeric buckets with linear scale', () => {
      const frame = toDataFrame({
        fields: [
          { name: 'time', type: FieldType.time, values: [1000, 2000] },
          {
            name: '1',
            type: FieldType.number,
            labels: { ge: '1' },
            values: [10, 15],
          },
          {
            name: '10',
            type: FieldType.number,
            labels: { ge: '10' },
            values: [20, 25],
          },
        ],
      });

      const heatmap = rowsToCellsHeatmap({
        frame,
        yBucketScale: { type: ScaleDistribution.Linear },
        layout: HeatmapCellLayout.ge,
      });

      expect(heatmap.fields[1].values).toEqual([1, 10, 1, 10]);
      expect(heatmap.fields[1].name).toBe('yMin'); // ge layout
    });

    it('generates yMax field for linear scale', () => {
      const frame = toDataFrame({
        fields: [
          { name: 'time', type: FieldType.time, values: [1000] },
          { name: '1', type: FieldType.number, values: [10] },
          { name: '2', type: FieldType.number, values: [20] },
          { name: '4', type: FieldType.number, values: [30] },
        ],
      });

      const heatmap = rowsToCellsHeatmap({
        frame,
        yBucketScale: { type: ScaleDistribution.Linear },
      });

      // Should have yMin, yMax, and count fields
      expect(heatmap.fields.length).toBe(4);
      expect(heatmap.fields[2].name).toBe('yMax');
      expect(heatmap.fields[2].type).toBe('number');

      // yMax should be [2, 4, 8] (shifted buckets + calculated last bucket)
      // Last bucket uses factor 2 (from 2→4) to estimate 4→8
      expect(heatmap.fields[2].values).toEqual([2, 4, 8]);
    });

    it('clears yOrdinalDisplay for linear scale', () => {
      const frame = toDataFrame({
        fields: [
          { name: 'time', type: FieldType.time, values: [1000] },
          { name: '1', type: FieldType.number, values: [10] },
          { name: '10', type: FieldType.number, values: [20] },
        ],
      });

      const heatmap = rowsToCellsHeatmap({
        frame,
        yBucketScale: { type: ScaleDistribution.Linear },
      });

      expect(heatmap.meta?.custom?.yOrdinalDisplay).toBeUndefined();
    });

    it('preserves yOrdinalDisplay for non-linear scale (auto/ordinal)', () => {
      const frame = toDataFrame({
        fields: [
          { name: 'time', type: FieldType.time, values: [1000] },
          { name: 'low', type: FieldType.number, values: [10] },
          { name: 'high', type: FieldType.number, values: [20] },
        ],
      });

      const heatmap = rowsToCellsHeatmap({ frame });

      expect(heatmap.meta?.custom?.yOrdinalDisplay).toEqual(['low', 'high']);
    });

    it('sets unit to undefined for linear scale (preserves original unit)', () => {
      const frame = toDataFrame({
        fields: [
          { name: 'time', type: FieldType.time, values: [1000] },
          { name: '1', type: FieldType.number, values: [10] },
          { name: '10', type: FieldType.number, values: [20] },
        ],
      });

      const heatmap = rowsToCellsHeatmap({
        frame,
        yBucketScale: { type: ScaleDistribution.Linear },
      });

      // Y field should not have 'short' unit for linear scale
      expect(heatmap.fields[1].config.unit).toBeUndefined();
    });

    it('sets unit to short for ordinal scale', () => {
      const frame = toDataFrame({
        fields: [
          { name: 'time', type: FieldType.time, values: [1000] },
          { name: 'low', type: FieldType.number, values: [10] },
          { name: 'high', type: FieldType.number, values: [20] },
        ],
      });

      const heatmap = rowsToCellsHeatmap({ frame });

      expect(heatmap.fields[1].config.unit).toBe('short');
    });

    it('uses "count" as value field name for linear scale', () => {
      const frame = toDataFrame({
        fields: [
          { name: 'time', type: FieldType.time, values: [1000] },
          { name: '1', type: FieldType.number, values: [10] },
          { name: '10', type: FieldType.number, values: [20] },
        ],
      });

      const heatmap = rowsToCellsHeatmap({
        frame,
        yBucketScale: { type: ScaleDistribution.Linear },
      });

      // Without yMax, should be 3 fields: xMax, y/yMin/yMax, yMax, count
      const valueField = heatmap.fields.find((f) => f.name === 'count');
      expect(valueField).toBeDefined();
    });

    it('uses "Value" as field name for ordinal scale', () => {
      const frame = toDataFrame({
        fields: [
          { name: 'time', type: FieldType.time, values: [1000] },
          { name: 'low', type: FieldType.number, values: [10] },
          { name: 'high', type: FieldType.number, values: [20] },
        ],
      });

      const heatmap = rowsToCellsHeatmap({ frame });

      const valueField = heatmap.fields.find((f) => f.name === 'Value');
      expect(valueField).toBeDefined();
    });

    it('respects custom value field name for linear scale', () => {
      const frame = toDataFrame({
        fields: [
          { name: 'time', type: FieldType.time, values: [1000] },
          { name: '1', type: FieldType.number, values: [10] },
          { name: '10', type: FieldType.number, values: [20] },
        ],
      });

      const heatmap = rowsToCellsHeatmap({
        frame,
        yBucketScale: { type: ScaleDistribution.Linear },
        value: 'Temperature',
      });

      const valueField = heatmap.fields.find((f) => f.name === 'Temperature');
      expect(valueField).toBeDefined();
    });

    it('calculates yMax upper bound using bucket factor', () => {
      const frame = toDataFrame({
        fields: [
          { name: 'time', type: FieldType.time, values: [1000] },
          { name: '1', type: FieldType.number, values: [10] },
          { name: '10', type: FieldType.number, values: [20] },
          { name: '100', type: FieldType.number, values: [30] },
        ],
      });

      const heatmap = rowsToCellsHeatmap({
        frame,
        yBucketScale: { type: ScaleDistribution.Linear },
      });

      // buckets: [1, 10, 100]
      // yMax: [10, 100, 1000] - last one calculated as 100 * 10
      const yMaxField = heatmap.fields.find((f) => f.name === 'yMax');
      expect(yMaxField?.values).toEqual([10, 100, 1000]);
    });
  });
});
