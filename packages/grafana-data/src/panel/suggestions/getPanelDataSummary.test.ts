import { createDataFrame } from '../../dataframe/processDataFrame';
import { FieldType } from '../../types/dataFrame';

import { getPanelDataSummary } from './getPanelDataSummary';

describe('getPanelDataSummary', () => {
  describe('when called with no dataframes', () => {
    it('should return summary with zero counts', () => {
      const summary = getPanelDataSummary();

      expect(summary.rowCountTotal).toBe(0);
      expect(summary.rowCountMax).toBe(0);
      expect(summary.fieldCount).toBe(0);
      expect(summary.frameCount).toBe(0);
      expect(summary.hasData).toBe(false);

      expect(summary.fieldCountByType(FieldType.time)).toBe(0);
      expect(summary.fieldCountByType(FieldType.number)).toBe(0);
      expect(summary.fieldCountByType(FieldType.string)).toBe(0);
      expect(summary.fieldCountByType(FieldType.boolean)).toBe(0);

      expect(summary.hasFieldType(FieldType.time)).toBe(false);
      expect(summary.hasFieldType(FieldType.number)).toBe(false);
      expect(summary.hasFieldType(FieldType.string)).toBe(false);
      expect(summary.hasFieldType(FieldType.boolean)).toBe(false);
    });
  });

  describe('when called with a single dataframes', () => {
    it('should return correct summary', () => {
      const frames = [
        createDataFrame({
          fields: [
            { name: 'time', type: FieldType.time, values: [1, 2, 3] },
            { name: 'value', type: FieldType.number, values: [10, 20, 30] },
          ],
        }),
      ];
      const summary = getPanelDataSummary(frames);

      expect(summary.rowCountTotal).toBe(3);
      expect(summary.rowCountMax).toBe(3);
      expect(summary.fieldCount).toBe(2);
      expect(summary.frameCount).toBe(1);
      expect(summary.hasData).toBe(true);

      expect(summary.fieldCountByType(FieldType.time)).toBe(1);
      expect(summary.fieldCountByType(FieldType.number)).toBe(1);
      expect(summary.fieldCountByType(FieldType.string)).toBe(0);
      expect(summary.fieldCountByType(FieldType.boolean)).toBe(0);

      expect(summary.hasFieldType(FieldType.time)).toBe(true);
      expect(summary.hasFieldType(FieldType.number)).toBe(true);
      expect(summary.hasFieldType(FieldType.string)).toBe(false);
      expect(summary.hasFieldType(FieldType.boolean)).toBe(false);
    });
  });

  describe('when called with multiple dataframes', () => {
    it('should return correct summary', () => {
      const frames = [
        createDataFrame({
          fields: [
            { name: 'time', type: FieldType.time, values: [1, 2, 3] },
            { name: 'value', type: FieldType.number, values: [10, 20, 30] },
          ],
        }),
        createDataFrame({
          fields: [
            { name: 'category', type: FieldType.string, values: ['A', 'B'] },
            { name: 'amount', type: FieldType.number, values: [100, 200] },
          ],
        }),
      ];
      const summary = getPanelDataSummary(frames);

      expect(summary.rowCountTotal).toBe(5);
      expect(summary.rowCountMax).toBe(3);
      expect(summary.fieldCount).toBe(4);
      expect(summary.frameCount).toBe(2);
      expect(summary.hasData).toBe(true);

      expect(summary.fieldCountByType(FieldType.time)).toBe(1);
      expect(summary.fieldCountByType(FieldType.number)).toBe(2);
      expect(summary.fieldCountByType(FieldType.string)).toBe(1);
      expect(summary.fieldCountByType(FieldType.boolean)).toBe(0);

      expect(summary.hasFieldType(FieldType.time)).toBe(true);
      expect(summary.hasFieldType(FieldType.number)).toBe(true);
      expect(summary.hasFieldType(FieldType.string)).toBe(true);
      expect(summary.hasFieldType(FieldType.boolean)).toBe(false);
    });
  });
});
