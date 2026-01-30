import { locationService } from '@grafana/runtime';

import {
  applySavedSearch,
  extractFilters,
  extractGroupBy,
  extractTimeRange,
  generateTriageUrl,
  isValidTriageQuery,
  parseFilterString,
  serializeCurrentState,
  serializeTriageSceneState,
} from './triageSavedSearchUtils';

// Mock locationService
jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  locationService: {
    push: jest.fn(),
  },
}));

describe('triageSavedSearchUtils', () => {
  // Store original window.location
  const originalLocation = window.location;

  beforeEach(() => {
    jest.clearAllMocks();

    // Reset URL for each test
    Object.defineProperty(window, 'location', {
      value: { href: 'http://localhost:3000/alerting/alerts' },
      writable: true,
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
    Object.defineProperty(window, 'location', {
      value: originalLocation,
      writable: true,
    });
  });

  describe('parseFilterString', () => {
    it('should parse a simple filter string', () => {
      const result = parseFilterString('alertname|=|test');
      expect(result).toEqual({ key: 'alertname', operator: '=', value: 'test' });
    });

    it('should parse filter with regex operator', () => {
      const result = parseFilterString('alertname|=~|foo.*');
      expect(result).toEqual({ key: 'alertname', operator: '=~', value: 'foo.*' });
    });

    it('should parse filter with not-equal operator', () => {
      const result = parseFilterString('severity|!=|warning');
      expect(result).toEqual({ key: 'severity', operator: '!=', value: 'warning' });
    });

    it('should handle pipes in the value', () => {
      const result = parseFilterString('alertname|=~|critical|warning');
      expect(result).toEqual({ key: 'alertname', operator: '=~', value: 'critical|warning' });
    });

    it('should handle empty value', () => {
      const result = parseFilterString('alertname|=|');
      expect(result).toEqual({ key: 'alertname', operator: '=', value: '' });
    });

    it('should return null for invalid format - no pipes', () => {
      const result = parseFilterString('invalid');
      expect(result).toBeNull();
    });

    it('should return null for invalid format - only one pipe', () => {
      const result = parseFilterString('alertname|test');
      expect(result).toBeNull();
    });

    it('should return null for empty key', () => {
      const result = parseFilterString('|=|test');
      expect(result).toBeNull();
    });

    it('should return null for empty operator', () => {
      const result = parseFilterString('alertname||test');
      expect(result).toBeNull();
    });
  });

  describe('isValidTriageQuery', () => {
    it('should return true for empty query', () => {
      expect(isValidTriageQuery('')).toBe(true);
    });

    it('should return true for valid query string', () => {
      expect(isValidTriageQuery('var-filters=test&var-groupBy=severity')).toBe(true);
    });

    it('should return true for encoded query string', () => {
      expect(isValidTriageQuery('var-filters=alertname%7C%3D%7Ctest')).toBe(true);
    });

    it('should return true for complex query with multiple params', () => {
      expect(isValidTriageQuery('var-filters=a&var-filters=b&var-groupBy=c&from=now-1h&to=now')).toBe(true);
    });
  });

  describe('extractTimeRange', () => {
    it('should extract time range from query', () => {
      const query = 'from=now-1h&to=now';
      expect(extractTimeRange(query)).toEqual({ from: 'now-1h', to: 'now' });
    });

    it('should return defaults when time range not present', () => {
      const query = 'var-filters=test';
      expect(extractTimeRange(query)).toEqual({ from: 'now-4h', to: 'now' });
    });

    it('should return defaults for empty query', () => {
      expect(extractTimeRange('')).toEqual({ from: 'now-4h', to: 'now' });
    });

    it('should handle partial time range - only from', () => {
      const query = 'from=now-2h';
      expect(extractTimeRange(query)).toEqual({ from: 'now-2h', to: 'now' });
    });

    it('should handle partial time range - only to', () => {
      const query = 'to=now-30m';
      expect(extractTimeRange(query)).toEqual({ from: 'now-4h', to: 'now-30m' });
    });
  });

  describe('extractGroupBy', () => {
    it('should extract groupBy value', () => {
      const query = 'var-groupBy=severity';
      expect(extractGroupBy(query)).toBe('severity');
    });

    it('should return null when groupBy not present', () => {
      const query = 'var-filters=test';
      expect(extractGroupBy(query)).toBeNull();
    });

    it('should return null for empty query', () => {
      expect(extractGroupBy('')).toBeNull();
    });
  });

  describe('extractFilters', () => {
    it('should extract single filter', () => {
      const query = 'var-filters=alertname%7C%3D%7Ctest';
      expect(extractFilters(query)).toEqual(['alertname|=|test']);
    });

    it('should extract multiple filters', () => {
      const query = 'var-filters=alertname%7C%3D%7Ctest&var-filters=severity%7C%3D%7Ccritical';
      expect(extractFilters(query)).toEqual(['alertname|=|test', 'severity|=|critical']);
    });

    it('should return empty array when no filters', () => {
      const query = 'var-groupBy=severity';
      expect(extractFilters(query)).toEqual([]);
    });

    it('should return empty array for empty query', () => {
      expect(extractFilters('')).toEqual([]);
    });
  });

  describe('generateTriageUrl', () => {
    it('should generate URL with query', () => {
      const query = 'var-filters=test&var-groupBy=severity';
      expect(generateTriageUrl(query)).toBe('/alerting/alerts?var-filters=test&var-groupBy=severity');
    });

    it('should return base path for empty query', () => {
      expect(generateTriageUrl('')).toBe('/alerting/alerts');
    });

    it('should use custom base path', () => {
      const query = 'var-filters=test';
      expect(generateTriageUrl(query, '/custom/path')).toBe('/custom/path?var-filters=test');
    });
  });

  describe('serializeCurrentState', () => {
    it('should serialize URL params', () => {
      Object.defineProperty(window, 'location', {
        value: {
          href: 'http://localhost:3000/alerting/alerts?var-filters=alertname%7C%3D%7Ctest&var-groupBy=severity&from=now-1h&to=now',
        },
        writable: true,
      });

      const result = serializeCurrentState();
      expect(result).toContain('var-filters=');
      expect(result).toContain('var-groupBy=severity');
      expect(result).toContain('from=now-1h');
      expect(result).toContain('to=now');
    });

    it('should handle multiple var-filters', () => {
      Object.defineProperty(window, 'location', {
        value: {
          href: 'http://localhost:3000/alerting/alerts?var-filters=a&var-filters=b',
        },
        writable: true,
      });

      const result = serializeCurrentState();
      const params = new URLSearchParams(result);
      expect(params.getAll('var-filters')).toEqual(['a', 'b']);
    });

    it('should return empty string when no relevant params', () => {
      Object.defineProperty(window, 'location', {
        value: { href: 'http://localhost:3000/alerting/alerts' },
        writable: true,
      });

      const result = serializeCurrentState();
      expect(result).toBe('');
    });

    it('should ignore non-triage params', () => {
      Object.defineProperty(window, 'location', {
        value: {
          href: 'http://localhost:3000/alerting/alerts?unrelated=param&var-groupBy=severity',
        },
        writable: true,
      });

      const result = serializeCurrentState();
      expect(result).toBe('var-groupBy=severity');
      expect(result).not.toContain('unrelated');
    });
  });

  describe('applySavedSearch', () => {
    it('should call locationService.push with saved search params', () => {
      const query = 'var-filters=alertname%7C%3D%7Ctest&var-groupBy=severity&from=now-1h&to=now';

      applySavedSearch(query);

      expect(locationService.push).toHaveBeenCalledWith(`/alerting/alerts?${query}`);
    });

    it('should call locationService.push with correct URL', () => {
      applySavedSearch('var-groupBy=severity');

      expect(locationService.push).toHaveBeenCalledWith('/alerting/alerts?var-groupBy=severity');
    });

    it('should handle empty query by navigating to base path', () => {
      applySavedSearch('');

      expect(locationService.push).toHaveBeenCalledWith('/alerting/alerts');
    });

    it('should handle multiple var-filters', () => {
      const query = 'var-filters=a&var-filters=b&var-filters=c';

      applySavedSearch(query);

      expect(locationService.push).toHaveBeenCalledWith(`/alerting/alerts?${query}`);
    });
  });

  describe('serializeTriageSceneState', () => {
    it('should serialize state with filters, groupBy, and time range', () => {
      const result = serializeTriageSceneState({
        timeRange: { from: 'now-1h', to: 'now' },
        filters: ['alertname|=|test'],
        groupBy: ['severity'],
      });

      const params = new URLSearchParams(result);
      expect(params.get('from')).toBe('now-1h');
      expect(params.get('to')).toBe('now');
      expect(params.getAll('var-filters')).toEqual(['alertname|=|test']);
      expect(params.getAll('var-groupBy')).toEqual(['severity']);
    });

    it('should serialize state with empty filters and groupBy', () => {
      const result = serializeTriageSceneState({
        timeRange: { from: 'now-4h', to: 'now' },
        filters: [],
        groupBy: [],
      });

      const params = new URLSearchParams(result);
      expect(params.get('from')).toBe('now-4h');
      expect(params.get('to')).toBe('now');
      expect(params.getAll('var-filters')).toEqual([]);
      expect(params.getAll('var-groupBy')).toEqual([]);
    });

    it('should serialize state with multiple filters', () => {
      const result = serializeTriageSceneState({
        timeRange: { from: 'now-1h', to: 'now' },
        filters: ['alertname|=|test', 'severity|=|critical'],
        groupBy: [],
      });

      const params = new URLSearchParams(result);
      expect(params.getAll('var-filters')).toEqual(['alertname|=|test', 'severity|=|critical']);
    });

    it('should serialize state with multiple groupBy values', () => {
      const result = serializeTriageSceneState({
        timeRange: { from: 'now-1h', to: 'now' },
        filters: [],
        groupBy: ['severity', 'alertname'],
      });

      const params = new URLSearchParams(result);
      expect(params.getAll('var-groupBy')).toEqual(['severity', 'alertname']);
    });

    it('should handle Date objects in time range', () => {
      const fromDate = new Date('2024-01-01T00:00:00Z');
      const toDate = new Date('2024-01-01T01:00:00Z');

      const result = serializeTriageSceneState({
        timeRange: { from: fromDate, to: toDate },
        filters: [],
        groupBy: [],
      });

      const params = new URLSearchParams(result);
      expect(params.get('from')).toBe(fromDate.toISOString());
      expect(params.get('to')).toBe(toDate.toISOString());
    });

    it('should filter out empty/falsy filter values', () => {
      const result = serializeTriageSceneState({
        timeRange: { from: 'now-1h', to: 'now' },
        filters: ['alertname|=|test', '', 'severity|=|critical'],
        groupBy: ['severity', ''],
      });

      const params = new URLSearchParams(result);
      expect(params.getAll('var-filters')).toEqual(['alertname|=|test', 'severity|=|critical']);
      expect(params.getAll('var-groupBy')).toEqual(['severity']);
    });

    it('should handle different relative time range formats', () => {
      const result = serializeTriageSceneState({
        timeRange: { from: 'now-7d', to: 'now-1d' },
        filters: [],
        groupBy: [],
      });

      const params = new URLSearchParams(result);
      expect(params.get('from')).toBe('now-7d');
      expect(params.get('to')).toBe('now-1d');
    });
  });
});
