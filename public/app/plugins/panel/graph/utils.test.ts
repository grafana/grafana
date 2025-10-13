import { toDataFrame, FieldType } from '@grafana/data';

import { getDataTimeRange, graphTimeFormat } from './utils';

describe('DataFrame utility functions', () => {
  const frame = toDataFrame({
    fields: [
      { name: 'fist', type: FieldType.time, values: [2, 3, 5] },
      { name: 'second', type: FieldType.time, values: [7, 8, 9] },
      { name: 'third', type: FieldType.number, values: [2000, 3000, 1000] },
    ],
  });
  it('Should find time range', () => {
    const range = getDataTimeRange([frame]);
    expect(range!.from).toEqual(2);
    expect(range!.to).toEqual(9);
  });

  describe('graphTimeFormat', () => {
    it('graphTimeFormat', () => {
      expect(graphTimeFormat(5, 1, 45 * 5 * 1000)).toBe('HH:mm:ss');
      expect(graphTimeFormat(5, 1, 7200 * 5 * 1000)).toBe('HH:mm');
      expect(graphTimeFormat(5, 1, 80000 * 5 * 1000)).toBe('MM/DD HH:mm');
      expect(graphTimeFormat(5, 1, 2419200 * 5 * 1000)).toBe('MM/DD');
      expect(graphTimeFormat(5, 1, 12419200 * 5 * 1000)).toBe('YYYY-MM');
    });
  });
});
