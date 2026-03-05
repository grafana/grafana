import { labelsToMatchers } from './timelineUtils';

describe('timelineUtils', () => {
  describe('labelsToMatchers', () => {
    it('returns empty array for empty labels', () => {
      expect(labelsToMatchers({})).toEqual([]);
    });

    it('converts a single label', () => {
      expect(labelsToMatchers({ alertname: 'HighCPU' })).toEqual([{ label: 'alertname', type: '=', value: 'HighCPU' }]);
    });

    it('converts multiple labels preserving insertion order', () => {
      const result = labelsToMatchers({ alertname: 'HighCPU', severity: 'critical', instance: 'server-1' });
      expect(result).toEqual([
        { label: 'alertname', type: '=', value: 'HighCPU' },
        { label: 'severity', type: '=', value: 'critical' },
        { label: 'instance', type: '=', value: 'server-1' },
      ]);
    });

    it('handles labels with empty values', () => {
      expect(labelsToMatchers({ empty: '' })).toEqual([{ label: 'empty', type: '=', value: '' }]);
    });
  });
});
