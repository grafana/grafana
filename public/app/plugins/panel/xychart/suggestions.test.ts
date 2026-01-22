import {
  createDataFrame,
  FieldType,
  getPanelDataSummary,
  PanelDataSummary,
  VisualizationSuggestionScore,
} from '@grafana/data';

import { xychartSuggestionsSupplier } from './suggestions';

describe('xychart suggestions', () => {
  it('should not suggest for data without frames', () => {
    const suggestions = xychartSuggestionsSupplier({ rawFrames: undefined } as PanelDataSummary);
    expect(suggestions).toBeUndefined();
  });

  it('should suggest XYChart if the data works with the default Auto series mapping', () => {
    const dataSummary = getPanelDataSummary([
      createDataFrame({
        fields: [
          { name: 'X', type: FieldType.number, values: [1, 2, 3, 4, 5] },
          { name: 'Y', type: FieldType.number, values: [5, 4, 3, 2, 1] },
        ],
      }),
    ]);
    const suggestions = xychartSuggestionsSupplier(dataSummary);
    expect(suggestions).toHaveLength(1);
    expect(suggestions?.[0].score).toBe(VisualizationSuggestionScore.Good);
  });

  it('weighs the suggestion a bit less if there is a time field', () => {
    const dataSummary = getPanelDataSummary([
      createDataFrame({
        fields: [
          { name: 'X', type: FieldType.number, values: [1, 2, 3, 4, 5] },
          { name: 'Y', type: FieldType.number, values: [5, 4, 3, 2, 1] },
          {
            name: 'time',
            type: FieldType.time,
            values: [1622505600000, 1622592000000, 1622678400000, 1622764800000, 1622851200000],
          },
        ],
      }),
    ]);
    const suggestions = xychartSuggestionsSupplier(dataSummary);
    expect(suggestions).toHaveLength(1);
    expect(suggestions?.[0].score).toBe(VisualizationSuggestionScore.OK);
  });
});
