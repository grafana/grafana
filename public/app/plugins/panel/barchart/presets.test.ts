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
      expect(presets).toMatchSnapshot();
    });
    it.each([2, 3, 10])('returns 4 presets when data has %i number fields', (i) => {
      const dataSummary = getPanelDataSummary([createPresetFrame(i)]);
      const presets = barchartPresetsSupplier({ dataSummary });

      expect(presets).toHaveLength(4);
      expect(presets).toMatchSnapshot();
    });
  });

  describe('preset structure', () => {
    it('each preset has name, options, fieldConfig, and cardOptions with previewModifier', () => {
      const dataSummary = getPanelDataSummary([createPresetFrame(1)]);
      const presets = barchartPresetsSupplier({ dataSummary });

      expect(presets).toMatchSnapshot();
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

      if (previewModifier) {
        previewModifier(suggestion);
      }

      expect(suggestion).toMatchSnapshot();
    });
  });

  describe('maxRows', () => {
    it('maxRows are respected if maxRows is greater then 20', () => {
      const dataSummary = getPanelDataSummary([createPresetFrame(3, 1000)]);
      dataSummary.rowCountMax = 21;
      const presets = barchartPresetsSupplier({ dataSummary });
      expect(presets).toHaveLength(4);
      expect(presets![0].cardOptions?.maxRows).toEqual(20);
    });

    // This seems unexpected, why would a maxRows of 20 return undefined?
    it.each([0, 10, 20, undefined, null])('maxRows are ignored if maxRows is 20 or fewer: %i', (i) => {
      const dataSummary = getPanelDataSummary([createPresetFrame(3, 1000)]);
      //@ts-expect-error
      dataSummary.rowCountMax = i;
      const presets = barchartPresetsSupplier({ dataSummary });
      expect(presets).toHaveLength(4);
      expect(presets![0].cardOptions?.maxRows).toEqual(undefined);
    });
  });
});
