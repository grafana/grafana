import { fuzzyFilter, fuzzyMatches, getFallbackFilter, shouldUseFuzzySearch } from './fuzzySearch';

describe('fuzzySearch', () => {
  describe('shouldUseFuzzySearch', () => {
    describe('should return true for valid fuzzy search terms', () => {
      it.each(['simple', 'CPU Alert', 'memory-usage', 'alert_rule_name', 'k8s pod alert', 'API Response Time'])(
        'returns true for "%s"',
        (searchTerm) => {
          expect(shouldUseFuzzySearch(searchTerm)).toBe(true);
        }
      );
    });

    describe('should return false for edge cases', () => {
      it('returns false for non-ASCII characters', () => {
        expect(shouldUseFuzzySearch('café')).toBe(false);
        expect(shouldUseFuzzySearch('règle')).toBe(false);
        expect(shouldUseFuzzySearch('アラート')).toBe(false);
      });

      it('returns false for symbol-only searches', () => {
        expect(shouldUseFuzzySearch('!!!')).toBe(false);
        expect(shouldUseFuzzySearch('***')).toBe(false);
        expect(shouldUseFuzzySearch('<<<>>>')).toBe(false);
        expect(shouldUseFuzzySearch('[]{}')).toBe(false);
      });

      it('returns false for very long search terms (>25 chars)', () => {
        const longTerm = 'this-is-a-very-long-search-term-that-exceeds-max-length';
        expect(longTerm.length).toBeGreaterThan(25);
        expect(shouldUseFuzzySearch(longTerm)).toBe(false);
      });

      it('returns false for too many terms (>5)', () => {
        expect(shouldUseFuzzySearch('cpu mem disk net io err')).toBe(false);
      });
    });
  });

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
    });

    describe('should handle performance edge cases', () => {
      it('limits out-of-order permutations for complex searches', () => {
        // This test ensures the outOfOrderLimit logic works without hanging
        const result = fuzzyFilter(testRules, (rule) => rule.name, 'cpu high memory low disk');
        // Should not hang and should return some results
        expect(Array.isArray(result)).toBe(true);
      });
    });
  });

  describe('getFallbackFilter', () => {
    const testItems = [
      { name: 'High CPU usage', id: '1' },
      { name: 'Memory too low', id: '2' },
      { name: 'API[5xx] Error', id: '3' },
    ];

    it('performs case-insensitive substring matching', () => {
      const result = getFallbackFilter(testItems, (item) => item.name, 'cpu');
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('High CPU usage');
    });

    it('returns all items for empty search', () => {
      const result = getFallbackFilter(testItems, (item) => item.name, '');
      expect(result).toHaveLength(testItems.length);
    });

    it('returns all items for whitespace search', () => {
      const result = getFallbackFilter(testItems, (item) => item.name, '   ');
      expect(result).toHaveLength(testItems.length);
    });

    it('handles special characters correctly', () => {
      const result = getFallbackFilter(testItems, (item) => item.name, '[5xx]');
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('API[5xx] Error');
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
      expect(fuzzyFilter(realWorldRules, (r) => r.name, 'grafana sync').length).toBeGreaterThan(0);
      expect(fuzzyFilter(realWorldRules, (r) => r.name, 'k8s cpu').length).toBeGreaterThan(0);
      expect(fuzzyFilter(realWorldRules, (r) => r.name, 'postgres pool').length).toBeGreaterThan(0);
      expect(fuzzyFilter(realWorldRules, (r) => r.name, '5xx error').length).toBeGreaterThan(0);
      expect(fuzzyFilter(realWorldRules, (r) => r.name, 'memory 90').length).toBeGreaterThan(0);
      expect(fuzzyFilter(realWorldRules, (r) => r.name, 'disk latency').length).toBeGreaterThan(0);
      expect(fuzzyFilter(realWorldRules, (r) => r.name, 'api p99').length).toBeGreaterThan(0);
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
