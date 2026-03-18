import { createDataFrame, createTheme, DataFrameType, dateTime, FieldType, toDataFrame } from '@grafana/data';
import { HeatmapCalculationMode, ScaleDistribution } from '@grafana/schema';

import { prepareHeatmapData } from './fields';
import { Options } from './panelcfg.gen';

const theme = createTheme();

/**
 * Creates a minimal DataFrame for heatmap tests.
 */
function createHeatmapRowsFrame(overrides?: { timeValues?: number[]; bucketValues?: number[]; bucketName?: string }) {
  const timeValues = overrides?.timeValues ?? [1000, 2000, 3000];
  const bucketValues = overrides?.bucketValues ?? [5, 10, 15];
  return toDataFrame({
    meta: { type: DataFrameType.HeatmapRows },
    fields: [
      { name: 'time', type: FieldType.time, values: timeValues },
      {
        name: overrides?.bucketName ?? 'bucket',
        type: FieldType.number,
        values: bucketValues,
        config: { unit: 'short' },
      },
    ],
  });
}

/**
 * Creates a dense HeatmapCells frame (single y field: x, y, count).
 */
function createDenseHeatmapCellsFrame() {
  return toDataFrame({
    meta: { type: DataFrameType.HeatmapCells },
    fields: [
      { name: 'x', type: FieldType.time, values: [1000, 1000, 2000, 2000] },
      { name: 'y', type: FieldType.number, values: [1, 2, 1, 2] },
      { name: 'count', type: FieldType.number, values: [5, 10, 15, 20] },
    ],
  });
}

/**
 * Creates a sparse HeatmapCells frame (yMin and yMax fields).
 */
function createSparseHeatmapCellsFrame() {
  return toDataFrame({
    meta: { type: DataFrameType.HeatmapCells },
    fields: [
      { name: 'xMax', type: FieldType.time, values: [1000, 1000, 2000, 2000] },
      { name: 'yMin', type: FieldType.number, values: [1, 4, 1, 4] },
      { name: 'yMax', type: FieldType.number, values: [4, 16, 4, 16] },
      { name: 'count', type: FieldType.number, values: [5, 10, 15, 20] },
    ],
  });
}

describe('Heatmap data', () => {
  const options: Options = { color: {} } as Options;

  const tpl = {
    frames: [],
    annotations: [],
    options,
    palette: [] as string[],
    theme,
    replaceVariables: undefined as ((v: string) => string) | undefined,
    timeRange: { from: dateTime(), to: dateTime(), raw: { from: 'now-1h', to: 'now' } },
  };

  it('omit empty series array', () => {
    const info = prepareHeatmapData({
      ...tpl,
      frames: [],
    });

    expect(info).toEqual({});
  });

  it('omit frame.length: 0', () => {
    const info = prepareHeatmapData({
      ...tpl,
      frames: [
        {
          fields: [{ name: '', config: {}, type: FieldType.time, values: [] }],
          length: 0,
        },
      ],
    });

    expect(info).toEqual({});
  });

  // Regression: frames where any field has an empty values array were previously
  // passed through to prepareHeatmapData and caused downstream errors.
  it('omits frame where a field has empty values array', () => {
    const info = prepareHeatmapData({
      ...tpl,
      frames: [
        {
          length: 2,
          fields: [
            { name: 'time', config: {}, type: FieldType.time, values: [1000, 2000] },
            { name: 'value', config: {}, type: FieldType.number, values: [] }, // empty values
          ],
        },
      ],
    });

    expect(info).toEqual({});
  });

  // Regression: a heatmap rows frame where all cell values are null should not
  // crash prepareHeatmapData — it should return a valid HeatmapData with heatmap set.
  it('handles heatmap rows frame with all-null values without throwing', () => {
    const frame = toDataFrame({
      meta: { type: DataFrameType.HeatmapRows },
      fields: [
        { name: 'time', type: FieldType.time, values: [1000, 2000, 3000] },
        { name: 'bucket', type: FieldType.number, values: [null, null, null] },
      ],
    });

    expect(() =>
      prepareHeatmapData({
        ...tpl,
        frames: [frame],
      })
    ).not.toThrow();

    const info = prepareHeatmapData({ ...tpl, frames: [frame] });
    expect(info.heatmap).toBeDefined();
  });

  // Regression: negative bucket values caused boundedMinMax to compute an
  // inverted color scale, resulting in all cells mapping to the same palette index.
  it('handles heatmap rows frame with negative values and computes valid color range', () => {
    const frame = toDataFrame({
      meta: { type: DataFrameType.HeatmapRows },
      fields: [
        { name: 'time', type: FieldType.time, values: [1000, 2000, 3000] },
        { name: 'bucket', type: FieldType.number, values: [-30, -20, -10] },
      ],
    });

    const info = prepareHeatmapData({
      ...tpl,
      palette: ['#000000', '#ffffff'],
      frames: [frame],
    });

    expect(info.heatmapColors).toBeDefined();
    // minValue should be negative and less than maxValue
    expect(info.heatmapColors!.minValue).toBeLessThan(0);
    expect(info.heatmapColors!.minValue).toBeLessThan(info.heatmapColors!.maxValue);
  });

  // Regression: exemplars attached to an annotation frame named 'exemplar' should
  // be threaded through to HeatmapData.exemplars even when frames also include
  // a separate annotation frame (e.g. a regular x-axis annotation).
  it('threads exemplar frame through to HeatmapData when annotations also include a non-exemplar frame', () => {
    const dataFrame = toDataFrame({
      meta: { type: DataFrameType.HeatmapRows },
      fields: [
        { name: 'time', type: FieldType.time, values: [1000, 2000] },
        { name: 'bucket', type: FieldType.number, values: [5, 10] },
      ],
    });

    const regularAnnotation = toDataFrame({
      name: 'annotation',
      fields: [
        { name: 'time', type: FieldType.time, values: [1500] },
        { name: 'text', type: FieldType.string, values: ['deploy'] },
      ],
    });

    const exemplarFrame = toDataFrame({
      name: 'exemplar',
      meta: { custom: { resultType: 'exemplar' } },
      fields: [
        { name: 'Time', type: FieldType.time, values: [1500] },
        { name: 'Value', type: FieldType.number, values: [7] },
      ],
    });

    const info = prepareHeatmapData({
      ...tpl,
      frames: [dataFrame],
      annotations: [regularAnnotation, exemplarFrame],
    });

    expect(info.exemplars).toBeDefined();
    expect(info.exemplars!.name).toBe('exemplar');
  });

  // Regression: when a HeatmapRows frame has only the time field and no numeric
  // bucket fields, rowsToCellsHeatmap throws.
  it('throws when heatmap rows frame has no numeric bucket fields', () => {
    const frame = toDataFrame({
      meta: { type: DataFrameType.HeatmapRows },
      fields: [{ name: 'time', type: FieldType.time, values: [1000, 2000] }],
    });

    expect(() =>
      prepareHeatmapData({
        ...tpl,
        frames: [frame],
      })
    ).toThrow('No numeric fields found for heatmap');
  });

  it('filters out empty frames and keeps valid ones', () => {
    const validFrame = createHeatmapRowsFrame();
    const emptyFrame = createDataFrame({
      fields: [
        { name: 'time', type: FieldType.time, values: [] },
        { name: 'value', type: FieldType.number, values: [] },
      ],
    });

    const infoWithEmpty = prepareHeatmapData({
      ...tpl,
      frames: [emptyFrame, validFrame],
    });

    expect(infoWithEmpty.heatmap!.fields[0]).toMatchObject({ name: 'xMax', values: [1000, 2000, 3000] });
    expect(infoWithEmpty.heatmap!.fields[1]).toMatchObject({ name: 'y', values: [0, 0, 0] });
    expect(infoWithEmpty.heatmap!.fields[2]).toMatchObject({ name: 'Value', values: [5, 10, 15] });
  });

  describe('calculate mode', () => {
    it('uses calculateHeatmapFromData when options.calculate is true', () => {
      const frame = toDataFrame({
        fields: [
          { name: 'time', type: FieldType.time, values: [10, 20, 30] },
          { name: 'value', type: FieldType.number, values: [10, 20, 30] },
        ],
      });

      const info = prepareHeatmapData({
        ...tpl,
        frames: [frame],
        timeRange: { from: dateTime(0), to: dateTime(50), raw: { from: '0', to: '50' } },
        options: {
          ...options,
          calculate: true,
          calculation: {
            xBuckets: { mode: HeatmapCalculationMode.Size, value: '10' },
            yBuckets: {
              mode: HeatmapCalculationMode.Size,
              value: '5',
              scale: { type: ScaleDistribution.Linear },
            },
          },
        },
        palette: ['#000', '#fff'],
      });

      expect(info.heatmap).toBeDefined();
      expect(info.heatmapColors).toBeDefined();
      expect(info.heatmap!.fields[0]).toMatchObject({
        name: 'xMin',
        values: [
          0, 0, 0, 0, 0, 10, 10, 10, 10, 10, 20, 20, 20, 20, 20, 30, 30, 30, 30, 30, 40, 40, 40, 40, 40, 50, 50, 50, 50,
          50,
        ],
      });
      expect(info.heatmap!.fields[1]).toMatchObject({
        name: 'yMin',
        values: [
          10, 15, 20, 25, 30, 10, 15, 20, 25, 30, 10, 15, 20, 25, 30, 10, 15, 20, 25, 30, 10, 15, 20, 25, 30, 10, 15,
          20, 25, 30,
        ],
      });
      expect(info.heatmap!.fields[2]).toMatchObject({
        name: 'Count',
        values: [0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      });
    });

    it('applies replaceVariables to calculation bucket values', () => {
      const replaceVariables = jest.fn((v: string) => (v === '${bucket}' ? '5' : v));
      const frame = toDataFrame({
        fields: [
          { name: 'time', type: FieldType.time, values: [1000, 2000] },
          { name: 'value', type: FieldType.number, values: [10, 20] },
        ],
      });

      prepareHeatmapData({
        ...tpl,
        frames: [frame],
        options: {
          ...options,
          calculate: true,
          calculation: {
            xBuckets: { mode: HeatmapCalculationMode.Size, value: '${bucket}' },
            yBuckets: {
              mode: HeatmapCalculationMode.Size,
              value: '5',
              scale: { type: ScaleDistribution.Linear },
            },
          },
        },
        replaceVariables,
      });

      expect(replaceVariables).toHaveBeenCalledWith('${bucket}');
    });
  });

  describe('HeatmapCells format', () => {
    it('returns getDenseHeatmapData for dense HeatmapCells frame', () => {
      const frame = createDenseHeatmapCellsFrame();

      const info = prepareHeatmapData({
        ...tpl,
        frames: [frame],
        palette: ['#000', '#888', '#fff'],
      });

      expect(info.heatmap!.fields[0]).toMatchObject({ name: 'x', values: [1000, 1000, 2000, 2000] });
      expect(info.heatmap!.fields[1]).toMatchObject({ name: 'y', values: [1, 2, 1, 2] });
      expect(info.heatmap!.fields[2]).toMatchObject({ name: 'count', values: [5, 10, 15, 20] });
      expect(info.heatmapColors).toBeDefined();
      expect(info.xBucketSize).toBeDefined();
      expect(info.yBucketSize).toBeDefined();
      expect(info.display).toBeDefined();
      expect(info.warning).toBeUndefined();
    });

    it('returns getSparseHeatmapData for sparse HeatmapCells frame', () => {
      const frame = createSparseHeatmapCellsFrame();

      const info = prepareHeatmapData({
        ...tpl,
        frames: [frame],
        palette: ['#000', '#888', '#fff'],
      });

      expect(info.heatmap!.fields[0]).toMatchObject({ name: 'xMax', values: [1000, 1000, 2000, 2000] });
      expect(info.heatmap!.fields[1]).toMatchObject({ name: 'yMin', values: [1, 4, 1, 4] });
      expect(info.heatmap!.fields[2]).toMatchObject({ name: 'yMax', values: [4, 16, 4, 16] });
      expect(info.heatmap!.fields[3]).toMatchObject({ name: 'count', values: [5, 10, 15, 20] });
      expect(info.heatmapColors).toBeDefined();
      expect(info.display).toBeDefined();
      expect(info.warning).toBeUndefined();
    });
  });

  describe('multiple frames without HeatmapRows', () => {
    it('outerJoins multiple frames and returns heatmap with series', () => {
      const frame1 = toDataFrame({
        fields: [
          { name: 'time', type: FieldType.time, values: [1000, 2000] },
          { name: 'value', type: FieldType.number, values: [10, 20], state: { displayName: '1' } },
        ],
      });
      const frame2 = toDataFrame({
        fields: [
          { name: 'time', type: FieldType.time, values: [1000, 2000] },
          { name: 'value', type: FieldType.number, values: [30, 40], state: { displayName: '2' } },
        ],
      });

      const info = prepareHeatmapData({
        ...tpl,
        frames: [frame1, frame2],
      });

      expect(info.heatmap!.fields[0]).toMatchObject({ name: 'xMax', values: [1000, 1000, 2000, 2000] });
      expect(info.heatmap!.fields[1]).toMatchObject({ name: 'y', values: [0, 1, 0, 1] });
      expect(info.heatmap!.fields[2]).toMatchObject({ name: 'Value', values: [10, 30, 20, 40] });
      expect(info.series).toBeDefined();
    });

    it('outerJoins multiple frames without sorting when displayNames are non-numeric', () => {
      const frame1 = toDataFrame({
        fields: [
          { name: 'time', type: FieldType.time, values: [1000, 2000] },
          { name: 'value', type: FieldType.number, values: [10, 20], state: { displayName: 'cpu' } },
        ],
      });
      const frame2 = toDataFrame({
        fields: [
          { name: 'time', type: FieldType.time, values: [1000, 2000] },
          { name: 'value', type: FieldType.number, values: [30, 40], state: { displayName: 'memory' } },
        ],
      });

      const info = prepareHeatmapData({
        ...tpl,
        frames: [frame1, frame2],
      });

      expect(info.heatmap!.fields[0]).toMatchObject({ name: 'xMax', values: [1000, 1000, 2000, 2000] });
      expect(info.heatmap!.fields[1]).toMatchObject({ name: 'y', values: [0, 1, 0, 1] });
      expect(info.heatmap!.fields[2]).toMatchObject({ name: 'Value', values: [10, 30, 20, 40] });
    });

    it('sorts frames by label when all numeric', () => {
      const frame1 = toDataFrame({
        fields: [
          { name: 'time', type: FieldType.time, values: [1000, 2000] },
          { name: 'value', type: FieldType.number, values: [10, 20], state: { displayName: '2' } },
        ],
      });
      const frame2 = toDataFrame({
        fields: [
          { name: 'time', type: FieldType.time, values: [1000, 2000] },
          { name: 'value', type: FieldType.number, values: [30, 40], state: { displayName: '10' } },
        ],
      });

      const info = prepareHeatmapData({
        ...tpl,
        frames: [frame1, frame2],
      });

      expect(info.heatmap!.fields[0]).toMatchObject({ name: 'xMax', values: [1000, 1000, 2000, 2000] });
      expect(info.heatmap!.fields[1]).toMatchObject({ name: 'y', values: [0, 1, 0, 1] });
      expect(info.heatmap!.fields[2]).toMatchObject({ name: 'Value', values: [10, 30, 20, 40] });
      expect(info.series?.fields[1]).toMatchObject({ values: [10, 20] });
      expect(info.series?.fields[2]).toMatchObject({ values: [30, 40] });
    });

    it('uses single frame as-is when number fields have non-numeric displayNames', () => {
      const frame = toDataFrame({
        fields: [
          { name: 'time', type: FieldType.time, values: [1000, 2000, 3000] },
          { name: 'bucket_a', type: FieldType.number, values: [5, 10, 15], state: { displayName: 'bucket_a' } },
          { name: 'bucket_b', type: FieldType.number, values: [20, 25, 30], state: { displayName: 'bucket_b' } },
        ],
      });

      const info = prepareHeatmapData({
        ...tpl,
        frames: [frame],
      });

      expect(info.heatmap!.fields[0]).toMatchObject({ name: 'xMax', values: [1000, 1000, 2000, 2000, 3000, 3000] });
      expect(info.heatmap!.fields[1]).toMatchObject({ name: 'y', values: [0, 1, 0, 1, 0, 1] });
      expect(info.heatmap!.fields[2]).toMatchObject({ name: 'Value', values: [5, 20, 10, 25, 15, 30] });
      expect(info.series?.fields[1]).toMatchObject({ name: 'bucket_a', values: [5, 10, 15] });
      expect(info.series?.fields[2]).toMatchObject({ name: 'bucket_b', values: [20, 25, 30] });
    });

    it('sorts and reorders number fields when displayNames are numeric', () => {
      const frame = toDataFrame({
        fields: [
          { name: 'time', type: FieldType.time, values: [1000, 2000] },
          { name: '10', type: FieldType.number, values: [5, 10], state: { displayName: '10' } },
          { name: '2', type: FieldType.number, values: [15, 20], state: { displayName: '2' } },
        ],
      });

      const info = prepareHeatmapData({
        ...tpl,
        frames: [frame],
      });

      expect(info.heatmap!.fields[0]).toMatchObject({ name: 'xMax', values: [1000, 1000, 2000, 2000] });
      expect(info.heatmap!.fields[1]).toMatchObject({ name: 'y', values: [0, 1, 0, 1] });
      expect(info.heatmap!.fields[2]).toMatchObject({ name: 'Value', values: [15, 5, 20, 10] });
      expect(info.series?.fields[1]).toMatchObject({ name: '2', values: [15, 20] });
      expect(info.series?.fields[2]).toMatchObject({ name: '10', values: [5, 10] });
    });
  });

  describe('data links', () => {
    it('assigns getLinks to fields with config.links', () => {
      const frame = createHeatmapRowsFrame();
      frame.fields[1].config = {
        ...frame.fields[1].config,
        links: [{ url: 'http://example.com', title: 'Link' }],
      };

      const info = prepareHeatmapData({
        ...tpl,
        frames: [frame],
      });

      expect(info.heatmap!.fields[0]).toMatchObject({ name: 'xMax', values: [1000, 2000, 3000] });
      expect(info.heatmap!.fields[1]).toMatchObject({ name: 'y', values: [0, 0, 0] });
      expect(info.heatmap!.fields[2]).toMatchObject({ name: 'Value', values: [5, 10, 15] });
      expect(info.series?.fields[1].getLinks).toBeDefined();
    });
  });

  describe('display options', () => {
    it('applies cellValues unit and decimals to display', () => {
      const frame = createDenseHeatmapCellsFrame();

      const info = prepareHeatmapData({
        ...tpl,
        frames: [frame],
        options: {
          ...options,
          cellValues: { unit: 'short', decimals: 2 },
        },
        palette: ['#000', '#fff'],
      });

      expect(info.heatmap!.fields[2]).toMatchObject({ name: 'count', values: [5, 10, 15, 20] });
      expect(info.display).toBeDefined();
      const formatted = info.display!(15.5);
      expect(formatted).toMatch(/\d/);
    });

    it('applies yAxis unit and decimals for dense heatmap', () => {
      const frame = toDataFrame({
        meta: { type: DataFrameType.HeatmapCells },
        fields: [
          { name: 'xMin', type: FieldType.time, values: [1000, 1000, 2000, 2000] },
          { name: 'yMin', type: FieldType.number, values: [1, 2, 1, 2] },
          { name: 'count', type: FieldType.number, values: [5, 10, 15, 20] },
        ],
      });

      const info = prepareHeatmapData({
        ...tpl,
        frames: [frame],
        options: {
          ...options,
          yAxis: { unit: 'short', decimals: 1 },
        },
        palette: ['#000', '#fff'],
      });

      expect(info.heatmap!.fields[0]).toMatchObject({ name: 'xMin', values: [1000, 1000, 2000, 2000] });
      expect(info.heatmap!.fields[1]).toMatchObject({ name: 'yMin', values: [1, 2, 1, 2] });
      expect(info.heatmap!.fields[2]).toMatchObject({ name: 'count', values: [5, 10, 15, 20] });
    });
  });

  describe('getDenseHeatmapData edge cases', () => {
    it('returns warning when dense frame has no value field', () => {
      const frame = toDataFrame({
        meta: { type: DataFrameType.HeatmapCells },
        fields: [
          { name: 'x', type: FieldType.time, values: [1000, 2000] },
          { name: 'y', type: FieldType.number, values: [1, 2] },
        ],
      });

      const info = prepareHeatmapData({
        ...tpl,
        frames: [frame],
        palette: ['#000', '#fff'],
      });

      expect(info.warning).toBe('Missing value field');
    });

    it('returns minimal heatmap when frame has fewer than 2 fields or length', () => {
      const frame = toDataFrame({
        meta: { type: DataFrameType.HeatmapCells },
        fields: [
          { name: 'x', type: FieldType.time, values: [1000] },
          { name: 'y', type: FieldType.number, values: [1] },
        ],
      });

      const info = prepareHeatmapData({
        ...tpl,
        frames: [frame],
        palette: ['#000', '#fff'],
      });

      expect(info.heatmap!.fields[0]).toMatchObject({ name: 'x', values: [1000] });
      expect(info.heatmap!.fields[1]).toMatchObject({ name: 'y', values: [1] });
      expect(info.heatmapColors).toBeUndefined();
    });
  });

  describe('filter values', () => {
    it('respects filterValues le and ge', () => {
      const frame = createDenseHeatmapCellsFrame();

      const info = prepareHeatmapData({
        ...tpl,
        frames: [frame],
        options: {
          ...options,
          filterValues: { le: 12, ge: 8 },
        },
        palette: ['#000', '#fff'],
      });

      expect(info.heatmapColors).toBeDefined();
      expect(info.heatmap!.fields[2]).toMatchObject({ name: 'count', values: [5, 10, 15, 20] });
    });
  });
});
