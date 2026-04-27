import { getPanelDataSummary, VisualizationSuggestionScore } from '@grafana/data';
import { createDataFrame, FieldType } from '@grafana/data/dataframe';

import { geomapSuggestionsSupplier } from './suggestions';

describe('geomapSuggestionsSupplier', () => {
  it('should not suggest when the panel summary has no data', () => {
    const summary = getPanelDataSummary();
    expect(geomapSuggestionsSupplier(summary)).toBeUndefined();
  });

  it('should not suggest when frames have no detectable location geometry', () => {
    const frames = [
      createDataFrame({
        fields: [{ name: 'cpu', type: FieldType.number, values: [0.1, 0.2] }],
      }),
    ];
    expect(geomapSuggestionsSupplier(getPanelDataSummary(frames))).toBeUndefined();
  });

  it('should suggest geomap at best score when a frame has latitude and longitude fields', () => {
    const frames = [
      createDataFrame({
        fields: [
          { name: 'latitude', type: FieldType.number, values: [0, 40.7] },
          { name: 'longitude', type: FieldType.number, values: [0, -74.1] },
        ],
      }),
    ];
    const suggestions = geomapSuggestionsSupplier(getPanelDataSummary(frames));
    expect(suggestions).toHaveLength(1);
    expect(suggestions![0].score).toBe(VisualizationSuggestionScore.Best);
  });

  it('should suggest geomap when a frame has a geohash column', () => {
    const frames = [
      createDataFrame({
        fields: [
          { name: 'city', type: FieldType.string, values: ['A', 'B'] },
          { name: 'geohash', type: FieldType.string, values: ['9q94r', 'dr5rs'] },
        ],
      }),
    ];
    const suggestions = geomapSuggestionsSupplier(getPanelDataSummary(frames));
    expect(suggestions).toHaveLength(1);
    expect(suggestions![0].score).toBe(VisualizationSuggestionScore.Best);
  });
});
