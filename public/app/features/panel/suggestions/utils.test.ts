import {
  createDataFrame,
  FieldType,
  getPanelDataSummary,
  PanelDataSummary,
  PanelData,
  LoadingState,
  getDefaultTimeRange,
} from '@grafana/data';

import { showDefaultSuggestion, hasData } from './utils';

describe('Suggestions utils', () => {
  describe('showDefaultSuggestion', () => {
    it('should return [{}] when fn returns true', () => {
      const fn = (panelDataSummary: PanelDataSummary) => panelDataSummary.hasFieldType(FieldType.string);
      const wrapped = showDefaultSuggestion(fn);
      const result = wrapped(
        getPanelDataSummary([
          createDataFrame({
            fields: [{ name: 'value', type: FieldType.string }],
          }),
        ])
      );
      expect(result).toEqual([{}]);
    });

    it('should return undefined when fn returns false', () => {
      const fn = (panelDataSummary: PanelDataSummary) => panelDataSummary.hasFieldType(FieldType.string);
      const wrapped = showDefaultSuggestion(fn);
      const result = wrapped(
        getPanelDataSummary([
          createDataFrame({
            fields: [{ name: 'value', type: FieldType.number }],
          }),
        ])
      );
      expect(result).toBeUndefined();
    });
  });

  describe('hasData', () => {
    it('should return false when data is undefined', () => {
      expect(hasData(undefined)).toBe(false);
    });

    it('should return false when data has no series', () => {
      const data: PanelData = {
        series: [],
        state: LoadingState.Done,
        timeRange: getDefaultTimeRange(),
      };
      expect(hasData(data)).toBe(false);
    });

    it('should return true when at least one series has data', () => {
      const data: PanelData = {
        state: LoadingState.Done,
        series: [
          createDataFrame({
            fields: [{ name: 'value', type: FieldType.number, values: [1, 2, 3] }],
          }),
        ],
        timeRange: getDefaultTimeRange(),
      };
      expect(hasData(data)).toBe(true);
    });
  });
});
