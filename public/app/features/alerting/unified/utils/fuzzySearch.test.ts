import { fuzzyFilter, fuzzyMatches } from './fuzzySearch';

describe('fuzzySearch', () => {
  describe('fuzzyMatches', () => {
    describe('should match with typos and fuzzy logic', () => {
      it.each([
        ['High CPU usage', 'cpu'],
        ['High CPU usage', 'hi usage'],
        ['High CPU usage', 'usge'], // typo
        ['Memory Alert Rule', 'memory'],
        ['Memory Alert Rule', 'alrt'], // typo
        ['k8s-pod-memory-high', 'pod memory'],
        ['API-Response-Time[5xx]', 'response'],
      ])('matches "%s" with search term "%s"', (target, searchTerm) => {
        expect(fuzzyMatches(target, searchTerm)).toBe(true);
      });
    });

    describe('should be case insensitive', () => {
      it.each([
        ['High CPU Usage', 'cpu'],
        ['high cpu usage', 'CPU'],
        ['Memory Alert', 'MEMORY'],
        ['DISK ALERT', 'disk'],
      ])('matches "%s" with search term "%s"', (target, searchTerm) => {
        expect(fuzzyMatches(target, searchTerm)).toBe(true);
      });
    });

    describe('should handle edge cases with fallback', () => {
      it('matches with non-ASCII characters using fallback', () => {
        expect(fuzzyMatches('Café Alert', 'café')).toBe(true);
        expect(fuzzyMatches('règle alerte', 'règle')).toBe(true);
      });

      it('matches with symbol-only searches using fallback', () => {
        expect(fuzzyMatches('API[5xx] Error', '[5xx]')).toBe(true);
        expect(fuzzyMatches('Memory > 90%', '> 90%')).toBe(true);
      });

      it('matches long search terms using fallback', () => {
        const longTarget = 'This:is:a:very:long:rule:name:that:definitely:exceeds:max:needle:length';
        const longSearchTerm = 'very:long:rule:name:that:definitely:exceeds:max:needle:length';
        expect(fuzzyMatches(longTarget, longSearchTerm)).toBe(true);
      });
    });

    describe('should handle empty and whitespace searches', () => {
      it('returns true for empty search terms', () => {
        expect(fuzzyMatches('Any Rule Name', '')).toBe(true);
        expect(fuzzyMatches('Any Rule Name', '   ')).toBe(true);
      });
    });

    describe('should not match unrelated terms', () => {
      it.each([
        ['CPU Alert', 'memory'],
        ['Memory Usage', 'disk'],
        ['API Response', 'database'],
      ])('does not match "%s" with search term "%s"', (target, searchTerm) => {
        expect(fuzzyMatches(target, searchTerm)).toBe(false);
      });
    });
  });

  describe('fuzzyFilter', () => {
    const testRules = [
      { name: 'High CPU usage', id: '1' },
      { name: 'Memory too low', id: '2' },
      { name: 'Disk space alert', id: '3' },
      { name: 'API Response Time', id: '4' },
      { name: 'k8s-pod-memory-high', id: '5' },
    ];

    describe('should filter with fuzzy matching', () => {
      it('filters by exact matches', () => {
        const result = fuzzyFilter(testRules, (rule) => rule.name, 'CPU');
        expect(result).toHaveLength(1);
        expect(result[0].name).toBe('High CPU usage');
      });

      it('filters with typos', () => {
        const result = fuzzyFilter(testRules, (rule) => rule.name, 'usge'); // typo for "usage"
        expect(result).toHaveLength(1);
        expect(result[0].name).toBe('High CPU usage');
      });

      it('filters with partial matches', () => {
        const result = fuzzyFilter(testRules, (rule) => rule.name, 'memory');
        expect(result).toHaveLength(2);
        expect(result.map((r) => r.name)).toContain('Memory too low');
        expect(result.map((r) => r.name)).toContain('k8s-pod-memory-high');
      });

      it('filters with multiple words', () => {
        const result = fuzzyFilter(testRules, (rule) => rule.name, 'api response');
        expect(result).toHaveLength(1);
        expect(result[0].name).toBe('API Response Time');
      });

      it('filters with non-consecutive words', () => {
        const result = fuzzyFilter(testRules, (rule) => rule.name, 'api time');
        expect(result).toHaveLength(1);
        expect(result[0].name).toBe('API Response Time');
      });
    });

    describe('should handle edge cases', () => {
      it('returns all items for empty search', () => {
        const result = fuzzyFilter(testRules, (rule) => rule.name, '');
        expect(result).toHaveLength(testRules.length);
      });

      it('returns all items for whitespace search', () => {
        const result = fuzzyFilter(testRules, (rule) => rule.name, '   ');
        expect(result).toHaveLength(testRules.length);
      });

      it('uses fallback for non-ASCII characters', () => {
        const rulesWithAccents = [
          { name: 'Café Alert', id: '1' },
          { name: 'Regular Alert', id: '2' },
        ];
        const result = fuzzyFilter(rulesWithAccents, (rule) => rule.name, 'café');
        expect(result).toHaveLength(1);
        expect(result[0].name).toBe('Café Alert');
      });

      it('uses fallback for symbol-only searches', () => {
        const rulesWithSymbols = [
          { name: 'API[5xx] Error', id: '1' },
          { name: 'Normal Error', id: '2' },
        ];
        const result = fuzzyFilter(rulesWithSymbols, (rule) => rule.name, '[5xx]');
        expect(result).toHaveLength(1);
        expect(result[0].name).toBe('API[5xx] Error');
      });

      it('uses fallback for very long search terms', () => {
        const longRuleName = 'This:is:a:very:long:rule:name:that:definitely:exceeds:max:needle:length';
        const rulesWithLongName = [
          { name: longRuleName, id: '1' },
          { name: 'Short rule name', id: '2' },
        ];
        const longSearchTerm = 'very:long:rule:name:that:definitely:exceeds:max:needle:length';
        const result = fuzzyFilter(rulesWithLongName, (rule) => rule.name, longSearchTerm);
        expect(result).toHaveLength(1);
        expect(result[0].name).toBe(longRuleName);
      });

      it('handles complex searches without hanging', () => {
        const result = fuzzyFilter(
          testRules,
          (rule) => rule.name,
          'cpu high memory low disk space alert response time'
        );
        // Should not hang and should return some results
        expect(Array.isArray(result)).toBe(true);
      });
    });
  });

  describe('real-world scenarios', () => {
    const realWorldRules = [
      { name: 'grafana_dashboard_sync_failed', id: '1' },
      { name: 'k8s-pod-cpu-usage-high', id: '2' },
      { name: 'PostgreSQL Connection Pool Exhausted', id: '3' },
      { name: 'HTTP 5xx Error Rate High', id: '4' },
      { name: 'Memory Usage > 90%', id: '5' },
      { name: 'Disk I/O Latency Critical', id: '6' },
      { name: 'API Response Time P99 > 500ms', id: '7' },
    ];

    it('handles common alerting rule patterns', () => {
      // Test various real-world search patterns
      expect(fuzzyFilter(realWorldRules, (r) => r.name, 'grafana sync')).toContainEqual({
        name: 'grafana_dashboard_sync_failed',
        id: '1',
      });
      expect(fuzzyFilter(realWorldRules, (r) => r.name, 'k8s cpu')).toContainEqual({
        name: 'k8s-pod-cpu-usage-high',
        id: '2',
      });
      expect(fuzzyFilter(realWorldRules, (r) => r.name, 'postgres pool')).toContainEqual({
        name: 'PostgreSQL Connection Pool Exhausted',
        id: '3',
      });
      expect(fuzzyFilter(realWorldRules, (r) => r.name, '5xx error')).toContainEqual({
        name: 'HTTP 5xx Error Rate High',
        id: '4',
      });
      expect(fuzzyFilter(realWorldRules, (r) => r.name, 'memory 90')).toContainEqual({
        name: 'Memory Usage > 90%',
        id: '5',
      });
      expect(fuzzyFilter(realWorldRules, (r) => r.name, 'disk latency')).toContainEqual({
        name: 'Disk I/O Latency Critical',
        id: '6',
      });
      expect(fuzzyFilter(realWorldRules, (r) => r.name, 'api p99')).toContainEqual({
        name: 'API Response Time P99 > 500ms',
        id: '7',
      });
    });

    it('handles typos in common alert terms', () => {
      expect(fuzzyMatches('PostgreSQL Connection Pool Exhausted', 'postgrs')).toBe(true);
      expect(fuzzyMatches('HTTP 5xx Error Rate High', 'eror rate')).toBe(true);
      expect(fuzzyMatches('Disk I/O Latency Critical', 'latentcy')).toBe(true);
    });

    it('handles mixed case and symbols', () => {
      expect(fuzzyMatches('Memory Usage > 90%', 'memory > 90')).toBe(true);
      expect(fuzzyMatches('API Response Time P99 > 500ms', 'p99 500ms')).toBe(true);
    });
  });
});
