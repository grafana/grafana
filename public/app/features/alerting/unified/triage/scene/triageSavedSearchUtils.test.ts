import { dateTime } from '@grafana/data';
import { locationService } from '@grafana/runtime';

import {
  applySavedSearch,
  buildTriageQueryStringFromParts,
  extractFilterObjects,
  generateTriageUrl,
  mergeTriageSavedSearches,
  serializeCurrentSearchState,
} from './triageSavedSearchUtils';

// Mock locationService
jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  locationService: {
    push: jest.fn(),
    getSearch: jest.fn(() => new URLSearchParams()),
  },
}));

describe('triageSavedSearchUtils', () => {
  // Store original window.location
  const originalLocation = window.location;
  const mockGetSearch = locationService.getSearch as jest.Mock;

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

  describe('buildTriageQueryStringFromParts', () => {
    it('builds query string with string time range', () => {
      const result = buildTriageQueryStringFromParts({
        filters: [{ key: 'alertstate', operator: '=', value: 'firing' }],
        groupBy: ['grafana_folder'],
        timeRange: { from: 'now-1h', to: 'now' },
      });
      const params = new URLSearchParams(result);
      expect(params.get('from')).toBe('now-1h');
      expect(params.get('to')).toBe('now');
      expect(params.getAll('var-groupBy')).toEqual(['grafana_folder']);
      expect(params.has('var-filters')).toBe(true);
    });

    it('builds query string with DateTime time range', () => {
      const fromDateTime = dateTime('2025-01-15T10:00:00Z');
      const toDateTime = dateTime('2025-01-15T11:00:00Z');
      const result = buildTriageQueryStringFromParts({
        groupBy: [],
        timeRange: { from: fromDateTime, to: toDateTime },
      });
      const params = new URLSearchParams(result);
      expect(params.get('from')).toBe('2025-01-15T10:00:00.000Z');
      expect(params.get('to')).toBe('2025-01-15T11:00:00.000Z');
    });

    it('handles empty filters and groupBy', () => {
      const result = buildTriageQueryStringFromParts({
        groupBy: [],
        timeRange: { from: 'now-4h', to: 'now' },
      });
      const params = new URLSearchParams(result);
      expect(params.get('from')).toBe('now-4h');
      expect(params.get('to')).toBe('now');
      expect(params.has('var-filters')).toBe(false);
      expect(params.has('var-groupBy')).toBe(false);
    });
  });

  describe('extractFilterObjects', () => {
    it('should extract and parse filter objects from query', () => {
      const query = 'var-filters=alertname%7C%3D%7Ctest&var-filters=severity%7C!%3D%7Cwarning';
      const result = extractFilterObjects(query);
      expect(result).toEqual([
        { key: 'alertname', operator: '=', value: 'test', values: ['test'] },
        { key: 'severity', operator: '!=', value: 'warning', values: ['warning'] },
      ]);
    });

    it('should return empty array if no filters', () => {
      const query = 'var-groupBy=severity&from=now-1h&to=now';
      const result = extractFilterObjects(query);
      expect(result).toEqual([]);
    });

    it('should handle filters with pipes in values (__gfp__ escaped)', () => {
      const query = 'var-filters=alertname%7C%3D~%7Ccritical__gfp__warning';
      const result = extractFilterObjects(query);
      expect(result).toEqual([
        { key: 'alertname', operator: '=~', value: 'critical|warning', values: ['critical|warning'] },
      ]);
    });

    it('should filter out invalid filter strings', () => {
      const query = 'var-filters=alertname%7C%3D%7Ctest&var-filters=invalid&var-filters=severity%7C%3D%7Ccritical';
      const result = extractFilterObjects(query);
      expect(result).toEqual([
        { key: 'alertname', operator: '=', value: 'test', values: ['test'] },
        { key: 'severity', operator: '=', value: 'critical', values: ['critical'] },
      ]);
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
      const params = new URLSearchParams('var-filters=alertname%7C%3D%7Ctest&var-groupBy=severity&from=now-1h&to=now');
      mockGetSearch.mockReturnValueOnce(params);

      const result = serializeCurrentSearchState();
      expect(result).toContain('var-filters=');
      expect(result).toContain('var-groupBy=severity');
      expect(result).toContain('from=now-1h');
      expect(result).toContain('to=now');
    });

    it('should handle multiple var-filters', () => {
      const params = new URLSearchParams('var-filters=a&var-filters=b');
      mockGetSearch.mockReturnValueOnce(params);

      const result = serializeCurrentSearchState();
      const resultParams = new URLSearchParams(result);
      expect(resultParams.getAll('var-filters')).toEqual(['a', 'b']);
    });

    it('should return empty string when no relevant params', () => {
      const params = new URLSearchParams();
      mockGetSearch.mockReturnValueOnce(params);

      const result = serializeCurrentSearchState();
      expect(result).toBe('');
    });

    it('should ignore non-triage params', () => {
      const params = new URLSearchParams('unrelated=param&var-groupBy=severity');
      mockGetSearch.mockReturnValueOnce(params);

      const result = serializeCurrentSearchState();
      expect(result).toBe('var-groupBy=severity');
      expect(result).not.toContain('unrelated');
    });
  });

  describe('mergeTriageSavedSearches', () => {
    const mkSearch = (id: string, name: string, isDefault = false) => ({
      id,
      name,
      query: `query-${id}`,
      isDefault,
    });

    it('returns predefined then user when no default', () => {
      const predefined = [mkSearch('p1', 'Predefined 1'), mkSearch('p2', 'Predefined 2')];
      const user = [mkSearch('u1', 'User 1')];
      const result = mergeTriageSavedSearches(predefined, user, null);
      expect(result.map((s) => s.id)).toEqual(['p1', 'p2', 'u1']);
    });

    it('puts default first when it is in predefined', () => {
      const predefined = [
        mkSearch('p1', 'Predefined 1'),
        mkSearch('p2', 'Predefined 2', true),
        mkSearch('p3', 'Predefined 3'),
      ];
      const user = [mkSearch('u1', 'User 1')];
      const result = mergeTriageSavedSearches(predefined, user, 'p2');
      expect(result.map((s) => s.id)).toEqual(['p2', 'p1', 'p3', 'u1']);
    });

    it('puts default first when it is in user saves', () => {
      const predefined = [mkSearch('p1', 'Predefined 1')];
      const user = [mkSearch('u1', 'User 1'), mkSearch('u2', 'User 2'), mkSearch('u3', 'User 3')];
      const result = mergeTriageSavedSearches(predefined, user, 'u2');
      expect(result.map((s) => s.id)).toEqual(['u2', 'p1', 'u1', 'u3']);
    });

    it('returns merged order when default is already first (index 0)', () => {
      const predefined = [mkSearch('p1', 'Predefined 1', true), mkSearch('p2', 'Predefined 2')];
      const user = [mkSearch('u1', 'User 1')];
      const result = mergeTriageSavedSearches(predefined, user, 'p1');
      expect(result.map((s) => s.id)).toEqual(['p1', 'p2', 'u1']);
    });

    it('handles empty predefined', () => {
      const user = [mkSearch('u1', 'User 1'), mkSearch('u2', 'User 2')];
      const result = mergeTriageSavedSearches([], user, 'u2');
      expect(result.map((s) => s.id)).toEqual(['u2', 'u1']);
    });

    it('handles empty user', () => {
      const predefined = [mkSearch('p1', 'Predefined 1'), mkSearch('p2', 'Predefined 2')];
      const result = mergeTriageSavedSearches(predefined, [], 'p2');
      expect(result.map((s) => s.id)).toEqual(['p2', 'p1']);
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
});
