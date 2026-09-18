import {
  createDataFrame,
  FieldType,
  getPanelDataSummary,
  type PreferredVisualisationType,
  type VisualizationSuggestion,
  VisualizationSuggestionScore,
} from '@grafana/data';

import { type FieldConfig, type Options } from './panelcfg.gen';
import { tableSuggestionsSupplier } from './suggestions';

function summaryWith(fieldCount: number, rowCount: number, preferredVisualisationType?: PreferredVisualisationType) {
  return getPanelDataSummary([
    createDataFrame({
      meta: preferredVisualisationType ? { preferredVisualisationType } : undefined,
      fields: Array.from({ length: fieldCount }, (_, i) => ({
        name: `f${i}`,
        type: FieldType.number,
        values: Array.from({ length: rowCount }, (_, j) => j),
      })),
    }),
  ]);
}

// the supplier is typed as returning suggestions | void; narrow to the array
function suggestionsFor(fieldCount: number, rowCount: number, preferredVisualisationType?: PreferredVisualisationType) {
  const result = tableSuggestionsSupplier(summaryWith(fieldCount, rowCount, preferredVisualisationType));
  if (!Array.isArray(result)) {
    throw new Error('expected the table supplier to always return suggestions');
  }
  return result;
}

describe('table suggestions supplier', () => {
  it('always returns exactly one suggestion regardless of data shape', () => {
    expect(suggestionsFor(1, 1)).toHaveLength(1);
    expect(tableSuggestionsSupplier(getPanelDataSummary([]))).toHaveLength(1);
  });

  describe('score', () => {
    it('scores Best when the frame prefers the table visualisation', () => {
      expect(suggestionsFor(2, 2, 'table')[0].score).toBe(VisualizationSuggestionScore.Best);
    });

    it('scores Good for many fields and many rows (>5 fields and >50 rows)', () => {
      expect(suggestionsFor(6, 51)[0].score).toBe(VisualizationSuggestionScore.Good);
    });

    it('scores only OK at the boundary (6 fields but exactly 50 rows)', () => {
      // both thresholds are strict `>`, so exactly-50 rows must not reach Good
      expect(suggestionsFor(6, 50)[0].score).toBe(VisualizationSuggestionScore.OK);
    });

    it('scores only OK at the boundary (exactly 5 fields with many rows)', () => {
      expect(suggestionsFor(5, 100)[0].score).toBe(VisualizationSuggestionScore.OK);
    });

    it('scores OK for a small dataset with no preferred type', () => {
      expect(suggestionsFor(2, 3)[0].score).toBe(VisualizationSuggestionScore.OK);
    });
  });

  describe('previewModifier', () => {
    function runModifier(fieldConfig?: { defaults: { custom?: Record<string, unknown> } }) {
      const suggestion = {
        options: { showHeader: true, disableKeyboardEvents: false },
        fieldConfig,
      } as unknown as VisualizationSuggestion<Options, FieldConfig>;
      suggestionsFor(2, 2)[0].cardOptions!.previewModifier!(suggestion);
      return suggestion;
    }

    it('hides the header and disables keyboard events in the preview card', () => {
      const suggestion = runModifier();
      expect(suggestion.options!.showHeader).toBe(false);
      expect(suggestion.options!.disableKeyboardEvents).toBe(true);
    });

    it('forces a 50px minWidth when the suggestion carries custom field config', () => {
      const suggestion = runModifier({ defaults: { custom: { minWidth: 200 } } });
      expect(suggestion.fieldConfig!.defaults.custom!.minWidth).toBe(50);
    });

    it('leaves field config untouched when there is no custom config', () => {
      const suggestion = runModifier({ defaults: {} });
      expect(suggestion.fieldConfig!.defaults.custom).toBeUndefined();
    });
  });
});
