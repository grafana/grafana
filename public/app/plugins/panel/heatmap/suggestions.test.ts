import {
  createDataFrame,
  DataFrameType,
  FieldType,
  getPanelDataSummary,
  VisualizationSuggestionScore,
} from '@grafana/data';

import { heatmapSuggestionsSupplier } from './suggestions';

describe('heatmap suggestions', () => {
  describe('applicability', () => {
    it('should not suggest for data without time field', () => {
      const dataSummary = getPanelDataSummary([
        createDataFrame({
          fields: [
            { name: 'value1', type: FieldType.number, values: [1, 2, 3] },
            { name: 'value2', type: FieldType.number, values: [4, 5, 6] },
          ],
        }),
      ]);

      const suggestions = heatmapSuggestionsSupplier(dataSummary);
      expect(suggestions).toBeUndefined();
    });

    it('should suggest for data with time and number fields', () => {
      const dataSummary = getPanelDataSummary([
        createDataFrame({
          fields: [
            { name: 'time', type: FieldType.time, values: [1609459200000, 1609462800000, 1609466400000] },
            { name: 'value1', type: FieldType.number, values: [1, 2, 3] },
            { name: 'value2', type: FieldType.number, values: [4, 5, 6] },
          ],
        }),
      ]);

      const suggestions = heatmapSuggestionsSupplier(dataSummary);
      expect(suggestions).toHaveLength(1);
    });
  });

  describe('scoring', () => {
    it('should score this as "OK" if the data is not particularly heatmap-y', () => {
      const dataSummary = getPanelDataSummary([
        createDataFrame({
          fields: [
            { name: 'time', type: FieldType.time, values: [1609459200000, 1609462800000, 1609466400000] },
            { name: 'value1', type: FieldType.number, values: [1, 2, 3] },
            { name: 'value2', type: FieldType.number, values: [4, 5, 6] },
          ],
        }),
      ]);

      const suggestions = heatmapSuggestionsSupplier(dataSummary);
      expect(suggestions).toEqual([expect.objectContaining({ score: VisualizationSuggestionScore.OK })]);
    });

    it.each([DataFrameType.HeatmapRows, DataFrameType.HeatmapCells])(
      'should score this as "Best" if the data explicitly has %s frame type',
      (frameType: DataFrameType) => {
        const dataSummary = getPanelDataSummary([
          createDataFrame({
            meta: { type: frameType },
            fields: [
              {
                name: 'time',
                type: FieldType.time,
                values: [1609459200000, 1609462800000, 1609466400000],
                display: jest.fn((v) => ({ text: '' + v, numeric: Number(v) })),
              },
              {
                name: 'value1',
                type: FieldType.number,
                values: [1, 2, 3],
                display: jest.fn((v) => ({ text: '' + v, numeric: Number(v) })),
              },
              {
                name: 'value2',
                type: FieldType.number,
                values: [4, 5, 6],
                display: jest.fn((v) => ({ text: '' + v, numeric: Number(v) })),
              },
              {
                name: 'value3',
                type: FieldType.number,
                values: [7, 8, 9],
                display: jest.fn((v) => ({ text: '' + v, numeric: Number(v) })),
              },
            ],
          }),
        ]);

        const suggestions = heatmapSuggestionsSupplier(dataSummary);
        expect(suggestions).toEqual([expect.objectContaining({ score: VisualizationSuggestionScore.Best })]);
      }
    );

    it('should score this as "Best" if the data has "ge" labels', () => {
      const dataSummary = getPanelDataSummary([
        createDataFrame({
          fields: [
            {
              name: 'time',
              type: FieldType.time,
              values: [1609459200000, 1609462800000, 1609466400000],
              display: jest.fn((v) => ({ text: '' + v, numeric: Number(v) })),
            },
            {
              name: 'value1',
              type: FieldType.number,
              values: [1, 2, 3],
              labels: { ge: '-Inf' },
              display: jest.fn((v) => ({ text: '' + v, numeric: Number(v) })),
            },
            {
              name: 'value2',
              type: FieldType.number,
              values: [4, 5, 6],
              labels: { ge: '0' },
              display: jest.fn((v) => ({ text: '' + v, numeric: Number(v) })),
            },
            {
              name: 'value3',
              type: FieldType.number,
              values: [7, 8, 9],
              labels: { ge: '10' },
              display: jest.fn((v) => ({ text: '' + v, numeric: Number(v) })),
            },
          ],
        }),
      ]);

      const suggestions = heatmapSuggestionsSupplier(dataSummary);
      expect(suggestions).toEqual([expect.objectContaining({ score: VisualizationSuggestionScore.Best })]);
    });

    it('should score this as "Best" if the data has "le" labels', () => {
      const dataSummary = getPanelDataSummary([
        createDataFrame({
          fields: [
            {
              name: 'time',
              type: FieldType.time,
              values: [1609459200000, 1609462800000, 1609466400000],
              display: jest.fn((v) => ({ text: '' + v, numeric: Number(v) })),
            },
            {
              name: 'value1',
              type: FieldType.number,
              values: [1, 2, 3],
              labels: { le: '1' },
              display: jest.fn((v) => ({ text: '' + v, numeric: Number(v) })),
            },
            {
              name: 'value2',
              type: FieldType.number,
              values: [4, 5, 6],
              labels: { le: '2' },
              display: jest.fn((v) => ({ text: '' + v, numeric: Number(v) })),
            },
            {
              name: 'value2',
              type: FieldType.number,
              values: [6, 2, 6],
              labels: { le: '4' },
              display: jest.fn((v) => ({ text: '' + v, numeric: Number(v) })),
            },
            {
              name: 'value3',
              type: FieldType.number,
              values: [7, 8, 9],
              labels: { le: 'Inf' },
              display: jest.fn((v) => ({ text: '' + v, numeric: Number(v) })),
            },
          ],
        }),
      ]);

      const suggestions = heatmapSuggestionsSupplier(dataSummary);
      expect(suggestions).toEqual([expect.objectContaining({ score: VisualizationSuggestionScore.Best })]);
    });

    it('should score this as "Best" if the field names are numeric in a way that makes sense', () => {
      const dataSummary = getPanelDataSummary([
        createDataFrame({
          fields: [
            {
              name: 'time',
              type: FieldType.time,
              values: [1609459200000, 1609462800000, 1609466400000],
              display: jest.fn((v) => ({ text: '' + v, numeric: Number(v) })),
            },
            {
              name: '0',
              type: FieldType.number,
              values: [1, 2, 3],
              display: jest.fn((v) => ({ text: '' + v, numeric: Number(v) })),
            },
            {
              name: '10',
              type: FieldType.number,
              values: [4, 5, 6],
              display: jest.fn((v) => ({ text: '' + v, numeric: Number(v) })),
            },
            {
              name: '20',
              type: FieldType.number,
              values: [7, 8, 9],
              display: jest.fn((v) => ({ text: '' + v, numeric: Number(v) })),
            },
            {
              name: 'Inf',
              type: FieldType.number,
              values: [10, 9, 8],
              display: jest.fn((v) => ({ text: '' + v, numeric: Number(v) })),
            },
          ],
        }),
      ]);

      const suggestions = heatmapSuggestionsSupplier(dataSummary);
      expect(suggestions).toEqual([expect.objectContaining({ score: VisualizationSuggestionScore.Best })]);
    });
  });
});
