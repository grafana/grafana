import { createDataFrame, FieldType } from '@grafana/data/dataframe';
import { getPanelDataSummary } from '@grafana/data/panel';
import { AxisPlacement, GraphDrawStyle, type GraphFieldConfig, StackingMode } from '@grafana/schema';

import { type Options } from './panelcfg.gen';
import { timeseriesPresetsSupplier } from './presets';

const getPresets = (...args: Parameters<typeof timeseriesPresetsSupplier>) => {
  return timeseriesPresetsSupplier(...args) || [];
};

const makeSummary = (frameCount: number, rowCount: number) => {
  const frames = Array.from({ length: frameCount }, (_, i) =>
    createDataFrame({
      fields: [
        { name: 'time', type: FieldType.time, values: Array.from({ length: rowCount }, (_, j) => j * 1000) },
        { name: `value${i}`, type: FieldType.number, values: Array.from({ length: rowCount }, (_, j) => j + i) },
      ],
    })
  );
  return getPanelDataSummary(frames);
};

describe('timeseriesPresetsSupplier', () => {
  it('returns empty array when dataSummary is undefined', () => {
    expect(timeseriesPresetsSupplier({ dataSummary: undefined })).toEqual([]);
  });

  it('returns empty array when there is no data', () => {
    expect(timeseriesPresetsSupplier({ dataSummary: getPanelDataSummary([]) })).toEqual([]);
  });

  it('returns empty array when frames have no rows', () => {
    expect(timeseriesPresetsSupplier({ dataSummary: makeSummary(1, 0) })).toEqual([]);
  });

  it('returns empty array when there is no time field', () => {
    const summary = getPanelDataSummary([
      createDataFrame({
        fields: [{ name: 'value', type: FieldType.number, values: [10, 20, 30] }],
      }),
    ]);
    expect(timeseriesPresetsSupplier({ dataSummary: summary })).toEqual([]);
  });

  it('returns empty array when there is no number field', () => {
    const summary = getPanelDataSummary([
      createDataFrame({
        fields: [
          { name: 'time', type: FieldType.time, values: [1, 2, 3] },
          { name: 'status', type: FieldType.string, values: ['ok', 'err', 'ok'] },
        ],
      }),
    ]);
    expect(timeseriesPresetsSupplier({ dataSummary: summary })).toEqual([]);
  });

  it('returns 6 presets for single series with few points', () => {
    const result = getPresets({ dataSummary: makeSummary(1, 3) });
    expect(result.map((p) => p.name)).toEqual([
      'Single fill',
      'Smooth scheme',
      'Dashed threshold',
      'Step fill',
      'Bars',
      'Bars scheme',
    ]);
  });

  it('returns 4 line-focused presets for single series with many points', () => {
    const result = getPresets({ dataSummary: makeSummary(1, 100) });
    expect(result.map((p) => p.name)).toEqual(['Line fill', 'Line hue', 'Line scheme', 'Threshold scheme']);
  });

  it('returns 3 presets with stacked bars for multi series with few points', () => {
    const result = getPresets({ dataSummary: makeSummary(2, 3) });
    expect(result.map((p) => p.name)).toEqual(['Lines with points', 'Stacked lines', 'Stacked bars']);

    const stackedBars = result.find((p) => p.name === 'Stacked bars');
    expect(stackedBars?.fieldConfig?.defaults?.custom?.drawStyle).toBe(GraphDrawStyle.Bars);
    expect(stackedBars?.fieldConfig?.defaults?.custom?.stacking?.mode).toBe(StackingMode.Normal);
  });

  it('returns 3 presets with stacked 100% for multi series with many points', () => {
    const result = getPresets({ dataSummary: makeSummary(2, 100) });
    expect(result.map((p) => p.name)).toEqual(['Lines with points', 'Stacked lines', 'Stacked 100%']);

    const stacked100 = result.find((p) => p.name === 'Stacked 100%');
    expect(stacked100?.fieldConfig?.defaults?.custom?.stacking?.mode).toBe(StackingMode.Percent);
  });

  it('all presets include a previewModifier', () => {
    const result = getPresets({ dataSummary: makeSummary(1, 3) });
    for (const preset of result) {
      expect(preset.cardOptions?.previewModifier).toBeDefined();
    }
  });

  describe('previewModifier', () => {
    const result = getPresets({ dataSummary: makeSummary(1, 3) });

    it('sets disableKeyboardEvents and hidden axis placement', () => {
      const preset = result[0];
      const custom: Partial<GraphFieldConfig> = { lineWidth: 1 };
      const suggestion = {
        ...preset,
        options: {} as Partial<Options>,
        fieldConfig: { defaults: { custom }, overrides: [] },
      };
      preset.cardOptions!.previewModifier!(suggestion);
      expect(suggestion.options!.disableKeyboardEvents).toBe(true);
      expect(suggestion.fieldConfig!.defaults!.custom!.axisPlacement).toBe(AxisPlacement.Hidden);
    });

    it('boosts lineWidth to at least 2 for non-bar presets', () => {
      const linePreset = result.find((p) => p.name === 'Single fill')!;
      const custom: Partial<GraphFieldConfig> = { lineWidth: 1 };
      const suggestion = {
        ...linePreset,
        options: {} as Partial<Options>,
        fieldConfig: { defaults: { custom }, overrides: [] },
      };
      linePreset.cardOptions!.previewModifier!(suggestion);
      expect(suggestion.fieldConfig!.defaults!.custom!.lineWidth).toBe(2);
    });

    it('does not boost lineWidth for bar presets', () => {
      const barPreset = result.find((p) => p.name === 'Bars')!;
      const custom: Partial<GraphFieldConfig> = { drawStyle: GraphDrawStyle.Bars, lineWidth: 3 };
      const suggestion = {
        ...barPreset,
        options: {} as Partial<Options>,
        fieldConfig: { defaults: { custom }, overrides: [] },
      };
      barPreset.cardOptions!.previewModifier!(suggestion);
      expect(suggestion.fieldConfig!.defaults!.custom!.lineWidth).toBe(3);
    });
  });
});
