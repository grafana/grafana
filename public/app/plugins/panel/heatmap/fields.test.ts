import { createTheme, DataFrameType, dateTime } from '@grafana/data';
import { createDataFrame, FieldType, toDataFrame } from '@grafana/data/dataframe';
import { HeatmapCalculationMode, ScaleDistribution } from '@grafana/schema';

import { prepareHeatmapData } from './fields';
import { type Options } from './panelcfg.gen';

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
    expect(prepareHeatmapData({ ...tpl, frames: [] })).toEqual({});
  });

  it('omit frame.length: 0', () => {
    expect(
      prepareHeatmapData({
        ...tpl,
        frames: [
          {
            fields: [{ name: '', config: {}, type: FieldType.time, values: [] }],
            length: 0,
          },
        ],
      })
    ).toEqual({});
  });

  // Regression: frames where any field has an empty values array were previously
  // passed through to prepareHeatmapData and caused downstream errors.
  it('omits frame where a field has empty values array', () => {
    expect(
      prepareHeatmapData({
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
      })
    ).toEqual({});
  });

  // Regression: a heatmap rows frame where all cell values are null should not
  // crash prepareHeatmapData — it should return a valid HeatmapData with heatmap set.
  it('handles all null', () => {
    const frame = toDataFrame({
      meta: { type: DataFrameType.HeatmapRows },
      fields: [
        { name: 'time', type: FieldType.time, values: [1000, 2000, 3000] },
        { name: 'bucket', type: FieldType.number, values: [null, null, null] },
      ],
    });

    const heatmap = prepareHeatmapData({ ...tpl, frames: [frame] });

    expect(heatmap.heatmap?.fields[0]).toMatchObject({
      name: 'xMax',
      type: 'time',
      values: [1000, 2000, 3000],
      config: {},
    });
    expect(heatmap.heatmap?.fields[1]).toMatchObject({
      name: 'y',
      type: 'number',
      config: {
        unit: 'short',
      },
      values: [0, 0, 0],
    });
    expect(heatmap.heatmap?.fields[2]).toMatchObject({
      name: 'Value',
      type: 'number',
      values: [null, null, null],
    });
    expect(heatmap.heatmap?.fields[2].state?.calcs).toMatchObject({
      allIsNull: true,
    });
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

    const heatmap = prepareHeatmapData({
      ...tpl,
      palette: ['#000000', '#ffffff'],
      frames: [frame],
    });

    expect(heatmap.heatmapColors).toMatchObject({
      maxValue: -10,
      minValue: -30,
      palette: ['#000000', '#ffffff'],
      values: [0, 1, 1],
    });
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
        { name: 'time', type: FieldType.time, values: [1450] },
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

    const heatmap = prepareHeatmapData({
      ...tpl,
      frames: [dataFrame],
      annotations: [regularAnnotation, exemplarFrame],
    });

    expect(heatmap.exemplars?.length).toEqual(1);
    expect(heatmap.exemplars?.fields[0].values).toEqual([1500]);
    expect(heatmap.exemplars?.fields[1].values).toEqual([7]);
  });

  // Regression: when a HeatmapRows frame has only the time field and no numeric
  // bucket fields, rowsToCellsHeatmap throws.
  it('throws when heatmap rows frame has no numeric bucket fields', () => {
    const frame = toDataFrame({
      meta: { type: DataFrameType.HeatmapRows },
      fields: [{ name: 'time', type: FieldType.time, values: [1000, 2000] }],
    });

    expect(() => prepareHeatmapData({ ...tpl, frames: [frame] })).toThrow('No numeric fields found for heatmap');
  });

  it('filters out empty frames and keeps valid ones', () => {
    const validFrame = createHeatmapRowsFrame();
    const emptyFrame = createDataFrame({
      fields: [
        { name: 'time', type: FieldType.time, values: [] },
        { name: 'value', type: FieldType.number, values: [] },
      ],
    });

    const heatmap = prepareHeatmapData({
      ...tpl,
      frames: [emptyFrame, validFrame],
    });

    expect(heatmap.heatmap).toMatchObject({
      fields: [
        {
          config: {},
          name: 'xMax',
          type: 'time',
          values: [1000, 2000, 3000],
        },
        {
          config: {
            unit: 'short',
          },
          name: 'y',
          type: 'number',
          values: [0, 0, 0],
        },
        {
          config: {
            unit: 'short',
          },
          name: 'Value',
          state: {
            calcs: {
              allIsNull: false,
              allIsZero: false,
              count: 3,
              delta: 10,
              diff: 10,
              diffperc: 200,
              first: 5,
              firstNotNull: 5,
              last: 15,
              lastNotNull: 15,
              logmin: 5,
              max: 15,
              mean: 10,
              min: 5,
              nonNullCount: 3,
              previousDeltaUp: true,
              range: 10,
              step: 5,
              sum: 30,
            },
          },
          type: 'number',
          values: [5, 10, 15],
        },
      ],
      length: 3,
      meta: {
        custom: {
          yOrdinalDisplay: ['bucket'],
        },
        type: 'heatmap-cells',
      },
    });
  });

  describe('calculate mode', () => {
    it('uses calculateHeatmapFromData when options.calculate is true', () => {
      const frame = toDataFrame({
        fields: [
          { name: 'time', type: FieldType.time, values: [10, 20, 30] },
          { name: 'value', type: FieldType.number, values: [10, 20, 30] },
        ],
      });

      const heatmap = prepareHeatmapData({
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

      expect(heatmap).toMatchObject({
        heatmap: {
          fields: [
            {
              name: 'xMin',
              values: [
                0, 0, 0, 0, 0, 10, 10, 10, 10, 10, 20, 20, 20, 20, 20, 30, 30, 30, 30, 30, 40, 40, 40, 40, 40, 50, 50,
                50, 50, 50,
              ],
            },
            {
              config: {
                custom: {
                  scaleDistribution: {
                    type: 'linear',
                  },
                },
              },
              name: 'yMin',
              values: [
                10, 15, 20, 25, 30, 10, 15, 20, 25, 30, 10, 15, 20, 25, 30, 10, 15, 20, 25, 30, 10, 15, 20, 25, 30, 10,
                15, 20, 25, 30,
              ],
            },
            {
              name: 'Count',
              values: [0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
            },
          ],
          length: 30,
          meta: {
            type: 'heatmap-cells',
          },
          name: 'value',
        },
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
      const heatmap = prepareHeatmapData({
        ...tpl,
        frames: [createDenseHeatmapCellsFrame()],
        palette: ['#000', '#888', '#fff'],
      });
      expect(heatmap).toMatchObject({
        heatmap: {
          fields: [
            {
              name: 'x',
              values: [1000, 1000, 2000, 2000],
            },
            {
              name: 'y',
              values: [1, 2, 1, 2],
            },
            {
              name: 'count',
              values: [5, 10, 15, 20],
            },
          ],
          length: 4,
        },
      });
    });

    it('returns getSparseHeatmapData for sparse HeatmapCells frame', () => {
      const heatmap = prepareHeatmapData({
        ...tpl,
        frames: [createSparseHeatmapCellsFrame()],
        palette: ['#000', '#888', '#fff'],
      });

      expect(heatmap.heatmap?.meta?.type).toEqual('heatmap-cells');
      expect(heatmap.heatmap?.length).toEqual(4);
      expect(heatmap.heatmap?.fields[0]).toMatchObject({
        name: 'xMax',
        type: 'time',
        values: [1000, 1000, 2000, 2000],
      });
      expect(heatmap.heatmap?.fields[1]).toMatchObject({
        name: 'yMin',
        type: 'number',
        values: [1, 4, 1, 4],
      });
      expect(heatmap.heatmap?.fields[2]).toMatchObject({
        name: 'yMax',
        type: 'number',
        values: [4, 16, 4, 16],
      });
      expect(heatmap.heatmap?.fields[3]).toMatchObject({
        name: 'count',
        type: 'number',
        values: [5, 10, 15, 20],
      });
      expect(heatmap.heatmapColors).toEqual({
        maxValue: 20,
        minValue: 5,
        palette: ['#000', '#888', '#fff'],
        values: [0, 1, 2, 2],
      });
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

      const heatmap = prepareHeatmapData({ ...tpl, frames: [frame1, frame2] });

      expect(heatmap.heatmap?.meta?.custom?.yOrdinalDisplay).toEqual(['value 1', 'value 2']);
      expect(heatmap.heatmap?.fields[0]).toMatchObject({
        name: 'xMax',
        values: [1000, 1000, 2000, 2000],
      });
      expect(heatmap.heatmap?.fields[1]).toMatchObject({
        name: 'y',
        values: [0, 1, 0, 1],
      });
      expect(heatmap.heatmap?.fields[2]).toMatchObject({
        name: 'Value',
        values: [10, 30, 20, 40],
      });
      expect(heatmap.series?.length).toEqual(2);
      expect(heatmap.series?.fields[1].state?.displayName).toEqual('value 1');
      expect(heatmap.series?.fields[2].state?.displayName).toEqual('value 2');
      expect(heatmap.heatmapColors).toMatchObject({
        maxValue: 40,
        minValue: 10,
        values: [-1, -1, -1, -1],
      });
      expect(heatmap.xBucketCount).toEqual(2);
      expect(heatmap.yBucketCount).toEqual(2);
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

      const heatmap = prepareHeatmapData({ ...tpl, frames: [frame1, frame2] });

      expect(heatmap.heatmap?.meta?.custom?.yOrdinalDisplay).toEqual(['value 1', 'value 2']);
      expect(heatmap.heatmap?.fields[2]).toMatchObject({
        name: 'Value',
        values: [10, 30, 20, 40],
      });
      expect(heatmap.series?.fields[1].state?.displayName).toEqual('value 1');
      expect(heatmap.series?.fields[2].state?.displayName).toEqual('value 2');
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

      const heatmap = prepareHeatmapData({ ...tpl, frames: [frame1, frame2] });

      expect(heatmap.heatmap?.meta?.custom?.yOrdinalDisplay).toEqual(['value 1', 'value 2']);
      expect(heatmap.heatmap?.fields[2]).toMatchObject({
        name: 'Value',
        values: [10, 30, 20, 40],
      });
      expect(heatmap.series?.fields[1].state?.displayName).toEqual('value 1');
      expect(heatmap.series?.fields[2].state?.displayName).toEqual('value 2');
    });

    it('uses single frame as-is when number fields have non-numeric displayNames', () => {
      const frame = toDataFrame({
        fields: [
          { name: 'time', type: FieldType.time, values: [1000, 2000, 3000] },
          { name: 'bucket_a', type: FieldType.number, values: [5, 10, 15], state: { displayName: 'bucket_a' } },
          { name: 'bucket_b', type: FieldType.number, values: [20, 25, 30], state: { displayName: 'bucket_b' } },
        ],
      });

      const heatmap = prepareHeatmapData({ ...tpl, frames: [frame] });

      expect(heatmap.heatmap?.meta?.custom?.yOrdinalDisplay).toEqual(['bucket_a', 'bucket_b']);
      expect(heatmap.heatmap?.length).toEqual(6);
      expect(heatmap.heatmap?.fields[2]).toMatchObject({
        name: 'Value',
        values: [5, 20, 10, 25, 15, 30],
      });
      expect(heatmap.series?.fields[1].name).toEqual('bucket_a');
      expect(heatmap.series?.fields[2].name).toEqual('bucket_b');
    });

    it('sorts and reorders number fields when displayNames are numeric', () => {
      const frame = toDataFrame({
        fields: [
          { name: 'time', type: FieldType.time, values: [1000, 2000] },
          { name: '10', type: FieldType.number, values: [5, 10], state: { displayName: '10' } },
          { name: '2', type: FieldType.number, values: [15, 20], state: { displayName: '2' } },
        ],
      });

      const heatmap = prepareHeatmapData({ ...tpl, frames: [frame] });

      expect(heatmap.heatmap?.meta?.custom?.yOrdinalDisplay).toEqual(['2', '10']);
      expect(heatmap.heatmap?.fields[2]).toMatchObject({
        name: 'Value',
        values: [15, 5, 20, 10],
      });
      expect(heatmap.series?.fields[1].name).toEqual('2');
      expect(heatmap.series?.fields[1].values).toEqual([15, 20]);
      expect(heatmap.series?.fields[2].name).toEqual('10');
      expect(heatmap.series?.fields[2].values).toEqual([5, 10]);
    });
  });

  describe('data links', () => {
    it('assigns getLinks to fields with config.links', () => {
      const frame = createHeatmapRowsFrame();
      frame.fields[1].config = {
        ...frame.fields[1].config,
        links: [{ url: 'http://example.com', title: 'Link' }],
      };

      const heatmap = prepareHeatmapData({ ...tpl, frames: [frame] });

      expect(heatmap.heatmap?.fields[2].config?.links).toEqual([{ url: 'http://example.com', title: 'Link' }]);
      expect(heatmap.series?.fields[1].getLinks).toEqual(expect.any(Function));
    });
  });

  describe('display options', () => {
    it('applies cellValues unit and decimals to display', () => {
      const heatmap = prepareHeatmapData({
        ...tpl,
        frames: [createDenseHeatmapCellsFrame()],
        options: {
          ...options,
          cellValues: { unit: 'short', decimals: 2 },
        },
        palette: ['#000', '#fff'],
      });

      expect(heatmap.heatmap?.fields[2]).toMatchObject({
        name: 'count',
        config: { unit: 'short', decimals: 2 },
      });
      expect(heatmap.heatmapColors).toEqual({
        maxValue: 20,
        minValue: 5,
        palette: ['#000', '#fff'],
        values: [0, 0, 1, 1],
      });
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

      const heatmap = prepareHeatmapData({
        ...tpl,
        frames: [frame],
        options: {
          ...options,
          yAxis: { unit: 'short', decimals: 1 },
        },
        palette: ['#000', '#fff'],
      });

      expect(heatmap.heatmap?.fields[1]).toMatchObject({
        name: 'yMin',
        config: { unit: 'short', decimals: 1 },
      });
      expect(heatmap.xLayout).toEqual('ge');
      expect(heatmap.yLayout).toEqual('ge');
      expect(heatmap.heatmapColors?.values).toEqual([0, 0, 1, 1]);
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

      const heatmap = prepareHeatmapData({
        ...tpl,
        frames: [frame],
        palette: ['#000', '#fff'],
      });

      expect(heatmap.warning).toEqual('Missing value field');
      expect(heatmap.heatmap?.fields.map((f) => f.name)).toEqual(['x', 'y']);
      expect(heatmap.heatmap?.length).toEqual(2);
    });

    it('returns non-broken heatmap when frame is too small', () => {
      const frame = toDataFrame({
        meta: { type: DataFrameType.HeatmapCells },
        fields: [
          { name: 'x', type: FieldType.time, values: [1000] },
          { name: 'y', type: FieldType.number, values: [1] },
        ],
      });

      const heatmap = prepareHeatmapData({
        ...tpl,
        frames: [frame],
        palette: ['#000', '#fff'],
      });

      expect(heatmap.warning).toBeUndefined();
      expect(heatmap.heatmap?.fields.map((f) => f.name)).toEqual(['x', 'y']);
      expect(heatmap.heatmap?.length).toEqual(1);
    });
  });

  describe('filter values', () => {
    it('respects filterValues le and ge', () => {
      const heatmap = prepareHeatmapData({
        ...tpl,
        frames: [createDenseHeatmapCellsFrame()],
        options: {
          ...options,
          filterValues: { le: 12, ge: 8 },
        },
        palette: ['#000', '#fff'],
      });

      expect(heatmap.heatmapColors).toMatchObject({
        maxValue: -Infinity,
        minValue: Infinity,
        palette: ['#000', '#fff'],
        values: [0, 0, 0, 0],
      });
    });
  });
});
