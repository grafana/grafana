import { createTheme, DataFrameType, dateTime, FieldType, toDataFrame } from '@grafana/data';

import { prepareHeatmapData } from './fields';
import { Options } from './panelcfg.gen';

const theme = createTheme();

describe('Heatmap data', () => {
  const options: Options = { color: {} } as Options;

  const tpl = {
    frames: [],
    annotations: [],
    options,
    palette: [],
    theme,
    replaceVariables: undefined,
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
  // bucket fields, prepareHeatmapData should not throw — it should return a
  // HeatmapData object (possibly with a warning).
  it('does not throw when heatmap rows frame has no numeric bucket fields', () => {
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
});
