import { createDataFrame, FieldType, getPanelDataSummary, PanelDataSummary } from '@grafana/data';

import { showDefaultSuggestion } from './utils';

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
});
