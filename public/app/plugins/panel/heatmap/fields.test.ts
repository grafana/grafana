import { createDataFrame, createTheme, DataFrameType, dateTime, FieldType, toDataFrame } from '@grafana/data';
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
  it('handles heatmap rows frame with all-null values without throwing', () => {
    const frame = toDataFrame({
      meta: { type: DataFrameType.HeatmapRows },
      fields: [
        { name: 'time', type: FieldType.time, values: [1000, 2000, 3000] },
        { name: 'bucket', type: FieldType.number, values: [null, null, null] },
      ],
    });

    expect(prepareHeatmapData({ ...tpl, frames: [frame] })).toMatchSnapshot();
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

    expect(
      prepareHeatmapData({
        ...tpl,
        palette: ['#000000', '#ffffff'],
        frames: [frame],
      })
    ).toMatchSnapshot();
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

    expect(
      prepareHeatmapData({
        ...tpl,
        frames: [dataFrame],
        annotations: [regularAnnotation, exemplarFrame],
      })
    ).toMatchSnapshot();
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

    expect(
      prepareHeatmapData({
        ...tpl,
        frames: [emptyFrame, validFrame],
      })
    ).toMatchSnapshot();
  });

  describe('calculate mode', () => {
    it('uses calculateHeatmapFromData when options.calculate is true', () => {
      const frame = toDataFrame({
        fields: [
          { name: 'time', type: FieldType.time, values: [10, 20, 30] },
          { name: 'value', type: FieldType.number, values: [10, 20, 30] },
        ],
      });

      expect(
        prepareHeatmapData({
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
        })
      ).toMatchSnapshot();
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
      expect(
        prepareHeatmapData({
          ...tpl,
          frames: [createDenseHeatmapCellsFrame()],
          palette: ['#000', '#888', '#fff'],
        })
      ).toMatchSnapshot();
    });

    it('returns getSparseHeatmapData for sparse HeatmapCells frame', () => {
      expect(
        prepareHeatmapData({
          ...tpl,
          frames: [createSparseHeatmapCellsFrame()],
          palette: ['#000', '#888', '#fff'],
        })
      ).toMatchSnapshot();
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

      expect(prepareHeatmapData({ ...tpl, frames: [frame1, frame2] })).toMatchSnapshot();
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

      expect(prepareHeatmapData({ ...tpl, frames: [frame1, frame2] })).toMatchSnapshot();
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

      expect(prepareHeatmapData({ ...tpl, frames: [frame1, frame2] })).toMatchSnapshot();
    });

    it('uses single frame as-is when number fields have non-numeric displayNames', () => {
      const frame = toDataFrame({
        fields: [
          { name: 'time', type: FieldType.time, values: [1000, 2000, 3000] },
          { name: 'bucket_a', type: FieldType.number, values: [5, 10, 15], state: { displayName: 'bucket_a' } },
          { name: 'bucket_b', type: FieldType.number, values: [20, 25, 30], state: { displayName: 'bucket_b' } },
        ],
      });

      expect(prepareHeatmapData({ ...tpl, frames: [frame] })).toMatchSnapshot();
    });

    it('sorts and reorders number fields when displayNames are numeric', () => {
      const frame = toDataFrame({
        fields: [
          { name: 'time', type: FieldType.time, values: [1000, 2000] },
          { name: '10', type: FieldType.number, values: [5, 10], state: { displayName: '10' } },
          { name: '2', type: FieldType.number, values: [15, 20], state: { displayName: '2' } },
        ],
      });

      expect(prepareHeatmapData({ ...tpl, frames: [frame] })).toMatchSnapshot();
    });
  });

  describe('data links', () => {
    it('assigns getLinks to fields with config.links', () => {
      const frame = createHeatmapRowsFrame();
      frame.fields[1].config = {
        ...frame.fields[1].config,
        links: [{ url: 'http://example.com', title: 'Link' }],
      };

      expect(prepareHeatmapData({ ...tpl, frames: [frame] })).toMatchSnapshot();
    });
  });

  describe('display options', () => {
    it('applies cellValues unit and decimals to display', () => {
      expect(
        prepareHeatmapData({
          ...tpl,
          frames: [createDenseHeatmapCellsFrame()],
          options: {
            ...options,
            cellValues: { unit: 'short', decimals: 2 },
          },
          palette: ['#000', '#fff'],
        })
      ).toMatchSnapshot();
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

      expect(
        prepareHeatmapData({
          ...tpl,
          frames: [frame],
          options: {
            ...options,
            yAxis: { unit: 'short', decimals: 1 },
          },
          palette: ['#000', '#fff'],
        })
      ).toMatchSnapshot();
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

      expect(
        prepareHeatmapData({
          ...tpl,
          frames: [frame],
          palette: ['#000', '#fff'],
        })
      ).toMatchSnapshot();
    });

    it('returns non-broken heatmap when frame is too small', () => {
      const frame = toDataFrame({
        meta: { type: DataFrameType.HeatmapCells },
        fields: [
          { name: 'x', type: FieldType.time, values: [1000] },
          { name: 'y', type: FieldType.number, values: [1] },
        ],
      });

      expect(
        prepareHeatmapData({
          ...tpl,
          frames: [frame],
          palette: ['#000', '#fff'],
        })
      ).toMatchSnapshot();
    });
  });

  describe('filter values', () => {
    it('respects filterValues le and ge', () => {
      expect(
        prepareHeatmapData({
          ...tpl,
          frames: [createDenseHeatmapCellsFrame()],
          options: {
            ...options,
            filterValues: { le: 12, ge: 8 },
          },
          palette: ['#000', '#fff'],
        })
      ).toMatchSnapshot();
    });
  });
});
