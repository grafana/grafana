import {
  createDataFrame,
  type DataFrame,
  FieldType,
  getPanelDataSummary,
  type VisualizationSuggestion,
} from '@grafana/data';
import { LegendDisplayMode } from '@grafana/schema';

import { type FieldConfig, type Options } from './panelcfg.gen';
import { barchartPresetsSupplier } from './presets';

/**
 * Creates a minimal DataFrame for barchart presets tests.
 * @param numNumberFields - Number of numeric value fields (default 1)
 * @param valueCount - Number of values in each field (default 3)
 */
function createPresetFrame(numNumberFields = 1, valueCount = 3): DataFrame {
  const fields = [
    { name: 'time', type: FieldType.time, values: Array.from({ length: valueCount }, (_, i) => 1000 * i) },
    ...Array.from({ length: numNumberFields }, (_, i) => ({
      name: `value${i + 1}`,
      type: FieldType.number,
      values: Array.from({ length: valueCount }, (_, i) => 10 * i),
    })),
  ];
  return createDataFrame({ fields });
}

describe('barchartPresetsSupplier', () => {
  it('returns empty array when dataSummary is undefined', () => {
    expect(barchartPresetsSupplier({ dataSummary: undefined })).toEqual([]);
  });

  it('returns empty array when there is no data', () => {
    expect(barchartPresetsSupplier({ dataSummary: getPanelDataSummary([]) })).toEqual([]);
  });

  it('returns empty array when frames have no rows', () => {
    const summary = getPanelDataSummary([
      createDataFrame({
        fields: [
          { name: 'category', type: FieldType.string, values: [] },
          { name: 'value', type: FieldType.number, values: [] },
        ],
      }),
    ]);
    expect(barchartPresetsSupplier({ dataSummary: summary })).toEqual([]);
  });

  it('returns empty array when there are no number fields', () => {
    const dataSummary = getPanelDataSummary([
      createDataFrame({
        fields: [
          { name: 'time', type: FieldType.time, values: [1, 2, 3] },
          { name: 'status', type: FieldType.string, values: ['ok', 'err', 'ok'] },
        ],
      }),
    ]);
    expect(barchartPresetsSupplier({ dataSummary })).toEqual([]);
  });

  it('returns presets when data has number fields', () => {
    const dataSummary = getPanelDataSummary([
      createDataFrame({
        fields: [
          { name: 'time', type: FieldType.time, values: [1, 2, 3] },
          { name: 'value', type: FieldType.number, values: [10, 20, 30] },
        ],
      }),
    ]);
    const result = barchartPresetsSupplier({ dataSummary });
    expect(result!.length).toBe(3);
  });

  it('includes stacked preset when multiple number fields exist', () => {
    const summary = getPanelDataSummary([createPresetFrame(2)]);
    const result = barchartPresetsSupplier({ dataSummary: summary });
    expect(result).toEqual(expect.arrayContaining([expect.objectContaining({ name: 'Palette classic stacked' })]));
  });

  describe('preset count by data', () => {
    it('returns 3 presets when data has a single number field', () => {
      const dataSummary = getPanelDataSummary([createPresetFrame(1)]);
      const presets = barchartPresetsSupplier({ dataSummary });

      expect(presets).toHaveLength(3);
      expect(presets![0]).toMatchObject({ name: 'Palette classic' });
      expect(presets![1]).toMatchObject({ name: 'Fixed purple hue' });
      expect(presets![2]).toMatchObject({ name: 'Viridis hue' });
    });
    it.each([2, 3, 10])('returns 4 presets when data has %i number fields', (i) => {
      const dataSummary = getPanelDataSummary([createPresetFrame(i)]);
      const presets = barchartPresetsSupplier({ dataSummary });

      expect(presets).toHaveLength(4);
    });
  });

  describe('preset structure', () => {
    it('each preset has name, options, fieldConfig, and cardOptions with previewModifier', () => {
      const dataSummary = getPanelDataSummary([createPresetFrame(1)]);
      const presets = barchartPresetsSupplier({ dataSummary });

      expect(presets).toHaveLength(3);
      expect(presets![0]).toMatchObject({
        name: 'Palette classic',
        options: {
          barRadius: 0.05,
          barWidth: 0.95,
          groupWidth: 0.8,
          stacking: 'none',
          xField: 'time',
          xTickLabelSpacing: 100,
        },
        cardOptions: {
          previewModifier: {},
        },
      });

      expect(presets![1]).toMatchObject({
        name: 'Fixed purple hue',
        options: {
          barRadius: 0,
          barWidth: 0.9,
          groupWidth: 0.8,
          stacking: 'none',
          xField: 'time',
          xTickLabelSpacing: 100,
        },
        cardOptions: {
          previewModifier: {},
        },
      });

      expect(presets![2]).toMatchObject({
        name: 'Viridis hue',
        options: {
          barRadius: 0,
          barWidth: 0.9,
          groupWidth: 0.8,
          stacking: 'none',
          xField: 'time',
          xTickLabelSpacing: 100,
        },
        cardOptions: {
          previewModifier: {},
        },
      });
    });
  });

  describe('previewModifier', () => {
    it('sets legend, axisPlacement, and barWidth', () => {
      const dataSummary = getPanelDataSummary([createPresetFrame(1)]);
      const presets = barchartPresetsSupplier({ dataSummary });
      if (!presets) {
        throw new Error('presets not defined!');
      }
      const preset = presets[0];
      const previewModifier = preset.cardOptions?.previewModifier;
      const suggestion: VisualizationSuggestion<Options, FieldConfig> = {
        options: {
          legend: {
            displayMode: LegendDisplayMode.List,
            showLegend: true,
            calcs: [],
            placement: 'right',
          },
          barWidth: 0.5,
        },
        fieldConfig: {
          defaults: {
            custom: { axisPlacement: undefined },
          },
          overrides: [],
        },
      };

      // before previewModifier
      expect(suggestion).toEqual({
        fieldConfig: {
          defaults: {
            custom: {
              axisPlacement: undefined,
            },
          },
          overrides: [],
        },
        options: {
          barWidth: 0.5,
          legend: {
            calcs: [],
            displayMode: 'list',
            placement: 'right',
            showLegend: true,
          },
        },
      });

      previewModifier!(suggestion);

      // after previewModifier
      expect(suggestion).toEqual({
        fieldConfig: {
          defaults: {
            custom: {
              axisPlacement: 'hidden',
            },
          },
          overrides: [],
        },
        options: {
          barWidth: 0.8,
          legend: {
            calcs: [],
            displayMode: 'hidden',
            placement: 'right',
            showLegend: false,
          },
        },
      });
    });
  });

  // rowCountMax on PanelDataSummary is the largest frame.length in the panel; barchart presets set cardOptions.maxRows only when that exceeds 20, to cap preview size.
  describe('rowCountMax', () => {
    it.each([21, 200000, Infinity])('when rowCountMax is %s, first preset cardOptions.maxRows is 20', (i) => {
      const dataSummary = getPanelDataSummary([createPresetFrame(3, 1000)]);
      dataSummary.rowCountMax = i;
      const presets = barchartPresetsSupplier({ dataSummary });
      expect(presets![0].cardOptions?.maxRows).toEqual(20);
    });

    it.each([0, 10, 20, undefined, null, -Infinity])(
      'when rowCountMax is %s, first preset cardOptions.maxRows is undefined',
      (i) => {
        const dataSummary = getPanelDataSummary([createPresetFrame(3, 1000)]);
        dataSummary.rowCountMax = i as number;
        const presets = barchartPresetsSupplier({ dataSummary });
        expect(presets![0].cardOptions?.maxRows).toEqual(undefined);
      }
    );
  });
});
