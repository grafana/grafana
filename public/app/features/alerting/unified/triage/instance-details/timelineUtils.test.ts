import { formatDuration, labelsToMatchers } from './timelineUtils';

describe('timelineUtils', () => {
  describe('formatDuration', () => {
    it('formats sub-second durations as milliseconds', () => {
      expect(formatDuration(0)).toBe('0ms');
      expect(formatDuration(1_000_000)).toBe('1ms');
      expect(formatDuration(500_000_000)).toBe('500ms');
      expect(formatDuration(999_000_000)).toBe('999ms');
    });

    it('formats durations under a minute as seconds', () => {
      expect(formatDuration(1_000_000_000)).toBe('1s');
      expect(formatDuration(30_000_000_000)).toBe('30s');
      expect(formatDuration(59_000_000_000)).toBe('59s');
    });

    it('formats durations under an hour as minutes and seconds', () => {
      expect(formatDuration(60_000_000_000)).toBe('1m');
      expect(formatDuration(90_000_000_000)).toBe('1m 30s');
      expect(formatDuration(3_540_000_000_000)).toBe('59m');
    });

    it('formats durations over an hour as hours and minutes', () => {
      expect(formatDuration(3_600_000_000_000)).toBe('1h');
      expect(formatDuration(5_400_000_000_000)).toBe('1h 30m');
      expect(formatDuration(7_200_000_000_000)).toBe('2h');
    });

    it('omits trailing zero units', () => {
      expect(formatDuration(120_000_000_000)).toBe('2m');
      expect(formatDuration(3_600_000_000_000)).toBe('1h');
    });
  });

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
