import { createDataFrame, FieldType, getPanelDataSummary, VisualizationSuggestionScore } from '@grafana/data';
import { GraphDrawStyle } from '@grafana/schema';

import { plugin } from './module';

const suggestionsSupplier = (plugin as unknown as { suggestionsSupplier: Function }).suggestionsSupplier;

function makeDataSummary(numericFieldCount: number, rowCount: number, frameCount = 1) {
  const fields = Array.from({ length: numericFieldCount }, (_, i) => ({
    name: i === 0 ? 'x' : `y${i}`,
    type: FieldType.number,
    values: Array.from({ length: rowCount }, (_, j) => j + 1),
  }));

  const frames = Array.from({ length: frameCount }, () =>
    createDataFrame({
      fields,
    })
  );

  return getPanelDataSummary(frames);
}

describe('trend panel suggestions supplier', () => {
  describe('early return conditions', () => {
    it('returns undefined when rawFrames is missing', () => {
      const dataSummary = getPanelDataSummary([]);
      expect(suggestionsSupplier({ ...dataSummary, rawFrames: undefined })).toBeUndefined();
    });

    it('returns undefined when there are fewer than 2 numeric fields', () => {
      const dataSummary = makeDataSummary(1, 3);
      expect(suggestionsSupplier(dataSummary)).toBeUndefined();
    });

    it('returns undefined when rowCountTotal is less than 2', () => {
      const dataSummary = makeDataSummary(2, 1);
      expect(suggestionsSupplier(dataSummary)).toBeUndefined();
    });

    it('returns undefined when there are more than 1 frame', () => {
      const dataSummary = makeDataSummary(2, 3, 2);
      expect(suggestionsSupplier(dataSummary)).toBeUndefined();
    });

    it('returns undefined when prepSeries returns a warning (non-ascending x)', () => {
      const frame = createDataFrame({
        fields: [
          { name: 'x', type: FieldType.number, values: [3, 2, 1] },
          { name: 'y', type: FieldType.number, values: [10, 20, 30] },
        ],
      });
      const dataSummary = getPanelDataSummary([frame]);

      expect(suggestionsSupplier(dataSummary)).toBeUndefined();
    });
  });

  describe('valid data', () => {
    function makeValidSummary() {
      return makeDataSummary(2, 3);
    }

    it('returns one suggestion for valid data', () => {
      const result = suggestionsSupplier(makeValidSummary());

      expect(result).toBeDefined();
      expect(result).toHaveLength(1);
    });

    it('returns a suggestion with Good score', () => {
      const result = suggestionsSupplier(makeValidSummary());

      expect(result![0].score).toBe(VisualizationSuggestionScore.Good);
    });

    it('returns a suggestion with empty custom fieldConfig defaults', () => {
      const result = suggestionsSupplier(makeValidSummary());

      expect(result![0].fieldConfig?.defaults?.custom).toEqual({});
      expect(result![0].fieldConfig?.overrides).toEqual([]);
    });
  });

  describe('previewModifier', () => {
    function getModifier() {
      const result = suggestionsSupplier(makeDataSummary(2, 3))!;
      return result[0].cardOptions!.previewModifier!;
    }

    it('boosts lineWidth to at least 2 for non-bar draw styles', () => {
      const modifier = getModifier();
      const suggestion = {
        options: {},
        fieldConfig: { defaults: { custom: { lineWidth: 1 } }, overrides: [] },
      };

      modifier(suggestion);

      expect(suggestion.fieldConfig.defaults.custom.lineWidth).toBe(2);
    });

    it('does not lower lineWidth when it is already above 2', () => {
      const modifier = getModifier();
      const suggestion = {
        options: {},
        fieldConfig: { defaults: { custom: { lineWidth: 5 } }, overrides: [] },
      };

      modifier(suggestion);

      expect(suggestion.fieldConfig.defaults.custom.lineWidth).toBe(5);
    });

    it('does not change lineWidth for bar draw style', () => {
      const modifier = getModifier();
      const suggestion = {
        options: {},
        fieldConfig: {
          defaults: { custom: { drawStyle: GraphDrawStyle.Bars, lineWidth: 1 } },
          overrides: [],
        },
      };

      modifier(suggestion);

      expect(suggestion.fieldConfig.defaults.custom.lineWidth).toBe(1);
    });
  });
});
