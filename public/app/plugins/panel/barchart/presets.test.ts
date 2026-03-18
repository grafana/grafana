import { createDataFrame, DataFrame, FieldType, getPanelDataSummary, VisualizationSuggestion } from '@grafana/data';
import { LegendDisplayMode } from '@grafana/schema';

import { FieldConfig, Options } from './panelcfg.gen';
import { barchartPresetsSupplier } from './presets';

/**
 * Creates a minimal DataFrame for barchart presets tests.
 * @param numNumberFields - Number of numeric value fields (default 1)
 */
function createPresetFrame(numNumberFields = 1): DataFrame {
  const fields = [
    { name: 'time', type: FieldType.time, values: [1000, 2000, 3000] },
    ...Array.from({ length: numNumberFields }, (_, i) => ({
      name: `value${i + 1}`,
      type: FieldType.number,
      values: [10, 20, 30],
    })),
  ];
  return createDataFrame({ fields });
}

describe('barchartPresetsSupplier', () => {
  describe('preset count by data', () => {
    it('returns 3 presets when data has a single number field', () => {
      const dataSummary = getPanelDataSummary([createPresetFrame(1)]);
      const presets = barchartPresetsSupplier({ dataSummary });

      expect(presets).toHaveLength(3);
      expect(presets).toMatchSnapshot();
    });

    it('returns 4 presets when data has multiple number fields', () => {
      const dataSummary = getPanelDataSummary([createPresetFrame(2)]);
      const presets = barchartPresetsSupplier({ dataSummary });

      expect(presets).toHaveLength(4);
      expect(presets).toMatchSnapshot();
    });

    it('returns 3 presets when dataSummary is undefined', () => {
      const presets = barchartPresetsSupplier({ dataSummary: undefined });

      expect(presets).toHaveLength(3);
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
});
