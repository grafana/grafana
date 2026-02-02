import { locationService } from '@grafana/runtime';

import {
  applySavedSearch,
  extractFilterObjects,
  generateTriageUrl,
  serializeCurrentState,
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
});
