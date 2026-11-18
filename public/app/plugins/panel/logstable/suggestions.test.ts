import {
  createDataFrame,
  DataFrameType,
  FieldType,
  getPanelDataSummary,
  VisualizationSuggestionScore,
} from '@grafana/data';

import { logstableSuggestionsSupplier } from './suggestions';

describe('logstable suggestions', () => {
  it('does not suggest logs table for non-log data', () => {
    const dataSummary = getPanelDataSummary([
      createDataFrame({
        fields: [
          { name: 'time', type: FieldType.time, values: [1, 2, 3] },
          { name: 'value', type: FieldType.number, values: [10, 20, 30] },
        ],
      }),
    ]);

    expect(logstableSuggestionsSupplier(dataSummary)).toBeUndefined();
  });

  it('suggests logs table for preferred logs visualization type', () => {
    const dataSummary = getPanelDataSummary([
      createDataFrame({
        meta: { preferredVisualisationType: 'logs' },
        fields: [{ name: 'line', type: FieldType.string, values: ['a', 'b', 'c'] }],
      }),
    ]);

    const suggestions = logstableSuggestionsSupplier(dataSummary);
    expect(suggestions).toHaveLength(1);
    expect(suggestions?.[0].score).toBe(VisualizationSuggestionScore.Best);
  });

  it('suggests logs table for LogLines frame type', () => {
    const dataSummary = getPanelDataSummary([
      createDataFrame({
        meta: { type: DataFrameType.LogLines },
        fields: [{ name: 'line', type: FieldType.string, values: ['a', 'b', 'c'] }],
      }),
    ]);

    const suggestions = logstableSuggestionsSupplier(dataSummary);
    expect(suggestions).toHaveLength(1);
    expect(suggestions?.[0].score).toBe(VisualizationSuggestionScore.Best);
  });
});
