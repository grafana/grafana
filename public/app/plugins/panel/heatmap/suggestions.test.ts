import {
  createDataFrame,
  DataFrameType,
  FieldType,
  getPanelDataSummary,
  VisualizationSuggestionScore,
} from '@grafana/data';

import * as fields from './fields';
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

    it('should not suggest for a generic table frame whose first field is non-monotonic (e.g. issue ids)', () => {
      const unsortedIssueIds = [1042, 87, 305, 1199, 41, 980];
      const dataSummary = getPanelDataSummary([
        createDataFrame({
          fields: [
            { name: 'id', type: FieldType.number, values: unsortedIssueIds },
            { name: 'lastSeen', type: FieldType.time, values: [1000, 2000, 3000, 4000, 5000, 6000] },
            { name: 'count', type: FieldType.number, values: [3, 7, 1, 9, 4, 2] },
            { name: 'users', type: FieldType.number, values: [1, 2, 1, 3, 2, 1] },
          ],
        }),
      ]);

      const suggestions = heatmapSuggestionsSupplier(dataSummary);
      expect(suggestions).toBeUndefined();
    });

    it('should not suggest when first field is non-monotonic even if prepareHeatmapData returns no warning', () => {
      const unsortedIssueIds = [1042, 87, 305, 1199, 41, 980];
      const frame = createDataFrame({
        fields: [
          { name: 'id', type: FieldType.number, values: unsortedIssueIds },
          { name: 'lastSeen', type: FieldType.time, values: [1000, 2000, 3000, 4000, 5000, 6000] },
          { name: 'count', type: FieldType.number, values: [3, 7, 1, 9, 4, 2] },
          { name: 'users', type: FieldType.number, values: [1, 2, 1, 3, 2, 1] },
        ],
      });
      const dataSummary = getPanelDataSummary([frame]);

      const prepareSpy = jest
        .spyOn(fields, 'prepareHeatmapData')
        .mockReturnValue({ heatmap: frame, xBucketSize: 1, yBucketSize: 1 });

      const suggestions = heatmapSuggestionsSupplier(dataSummary);
      expect(suggestions).toBeUndefined();
      prepareSpy.mockRestore();
    });

    describe('first field shape determines whether a heatmap suggestion is offered', () => {
      function summaryWithFirstField(type: FieldType, values: readonly unknown[]) {
        return getPanelDataSummary([
          createDataFrame({
            fields: [
              { name: 'x', type, values: [...values] },
              { name: 'time', type: FieldType.time, values: [1000, 2000, 3000] },
              { name: 'count', type: FieldType.number, values: [1, 2, 3] },
            ],
          }),
        ]);
      }

      it.each([
        ['ascending number', FieldType.number, [1, 2, 3], true],
        ['descending number', FieldType.number, [3, 2, 1], false],
        ['number with NaN', FieldType.number, [1, NaN, 3], false],
        ['number with adjacent duplicates', FieldType.number, [1, 1, 2, 2, 3], true],
        ['string', FieldType.string, ['a', 'b', 'c'], false],
        ['boolean', FieldType.boolean, [true, false, true], false],
        ['ascending time', FieldType.time, [1000, 2000, 3000], true],
        ['unsorted time', FieldType.time, [3000, 1000, 2000], false],
      ] as const)('%s first field offers suggestion: %s', (_label, type, values, shouldSuggest) => {
        const suggestions = heatmapSuggestionsSupplier(summaryWithFirstField(type, values));
        if (shouldSuggest) {
          expect(suggestions).toHaveLength(1);
        } else {
          expect(suggestions).toBeUndefined();
        }
      });
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
