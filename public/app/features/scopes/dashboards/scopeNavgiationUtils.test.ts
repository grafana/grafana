import {
  buildSubScopePath,
  deserializeFolderPath,
  getDashboardPathForComparison,
  isCurrentPath,
  serializeFolderPath,
} from './scopeNavgiationUtils';
import { SuggestedNavigationsFoldersMap } from './types';

describe('scopeNavgiationUtils', () => {
  it('should return the correct path for a dashboard', () => {
    expect(getDashboardPathForComparison('/d/dashboardId/slug')).toBe('/d/dashboardId');
    expect(getDashboardPathForComparison('/d/dashboardId')).toBe('/d/dashboardId');
    expect(getDashboardPathForComparison('/d/dashboardId/slug?query=param')).toBe('/d/dashboardId');
  });

  it('should return the correct path for a navigation', () => {
    expect(isCurrentPath('/d/dashboardId/slug', '/d/dashboardId')).toBe(true);
    expect(isCurrentPath('/d/dashboardId', '/d/dashboardId')).toBe(true);
  });

  it('shoudl handle non-dashboard paths', () => {
    expect(isCurrentPath('/other/path', '/other/path')).toBe(true);
    expect(isCurrentPath('/other/path', '/other/path?query=param')).toBe(true);
    expect(isCurrentPath('/other/path', '/other/path#hash')).toBe(true);
    expect(isCurrentPath('/other/path', '/other/path?query=param#hash')).toBe(true);
  });

  it('should return the correct path for a navigation with query params', () => {
    expect(isCurrentPath('/d/dashboardId/slug', '/d/dashboardId?query=param')).toBe(true);
    expect(isCurrentPath('/d/dashboardId', '/d/dashboardId?query=param')).toBe(true);
  });

  it('should return the correct path for a navigation with hash', () => {
    expect(isCurrentPath('/d/dashboardId/slug', '/d/dashboardId#hash')).toBe(true);
    expect(isCurrentPath('/d/dashboardId', '/d/dashboardId#hash')).toBe(true);
  });

  describe('deserializeFolderPath', () => {
    it('should return empty array for empty string', () => {
      expect(deserializeFolderPath('')).toEqual([]);
    });

    it('should parse a simple comma-separated string', () => {
      expect(deserializeFolderPath('mimir,loki')).toEqual(['mimir', 'loki']);
    });

    it('should handle single value', () => {
      expect(deserializeFolderPath('mimir')).toEqual(['mimir']);
    });

    it('should trim whitespace around values', () => {
      expect(deserializeFolderPath(' mimir , loki ')).toEqual(['mimir', 'loki']);
    });

    it('should handle URL-encoded strings', () => {
      expect(deserializeFolderPath(encodeURIComponent('mimir,loki'))).toEqual(['mimir', 'loki']);
    });

    it('should handle URL-encoded strings with special characters', () => {
      expect(deserializeFolderPath(encodeURIComponent('folder one,folder two'))).toEqual(['folder one', 'folder two']);
    });

    it('should fallback to split without decoding if decodeURIComponent fails', () => {
      // Invalid URI sequence that would cause decodeURIComponent to throw
      const invalidUri = '%E0%A4%A';
      expect(deserializeFolderPath(invalidUri)).toEqual(['%E0%A4%A']);
    });
  });

  describe('serializeFolderPath', () => {
    it('should return empty string for empty array', () => {
      expect(serializeFolderPath([])).toBe('');
    });

    it('should serialize a simple array', () => {
      expect(serializeFolderPath(['mimir', 'loki'])).toBe(encodeURIComponent('mimir,loki'));
    });

    it('should handle single value', () => {
      expect(serializeFolderPath(['mimir'])).toBe('mimir');
    });

    it('should handle values with spaces', () => {
      expect(serializeFolderPath(['folder one', 'folder two'])).toBe(encodeURIComponent('folder one,folder two'));
    });

    it('should return empty string for null/undefined input', () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect(serializeFolderPath(null as any)).toBe('');
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect(serializeFolderPath(undefined as any)).toBe('');
    });
  });

  describe('serializeFolderPath and deserializeFolderPath round-trip', () => {
    it('should round-trip simple paths', () => {
      const original = ['mimir', 'loki'];
      const serialized = serializeFolderPath(original);
      const deserialized = deserializeFolderPath(serialized);
      expect(deserialized).toEqual(original);
    });

    it('should round-trip paths with spaces', () => {
      const original = ['folder one', 'folder two'];
      const serialized = serializeFolderPath(original);
      const deserialized = deserializeFolderPath(serialized);
      expect(deserialized).toEqual(original);
    });
  });

  describe('buildSubScopePath', () => {
    it('should return undefined when folders is empty', () => {
      const folders: SuggestedNavigationsFoldersMap = {};
      expect(buildSubScopePath('mimir', folders)).toBeUndefined();
    });

    it('should find subScope at root level', () => {
      const folders: SuggestedNavigationsFoldersMap = {
        'Mimir Dashboards': {
          title: 'Mimir Dashboards',
          expanded: false,
          folders: {},
          suggestedNavigations: {},
          subScopeName: 'mimir',
        },
      };
      expect(buildSubScopePath('mimir', folders)).toEqual(['Mimir Dashboards']);
    });

    it('should find subScope in nested folders', () => {
      const folders: SuggestedNavigationsFoldersMap = {
        '': {
          title: '',
          expanded: true,
          folders: {
            'Parent Folder': {
              title: 'Parent Folder',
              expanded: false,
              folders: {
                'Mimir Dashboards': {
                  title: 'Mimir Dashboards',
                  expanded: false,
                  folders: {},
                  suggestedNavigations: {},
                  subScopeName: 'mimir',
                },
              },
              suggestedNavigations: {},
            },
          },
          suggestedNavigations: {},
        },
      };
      expect(buildSubScopePath('mimir', folders)).toEqual(['', 'Parent Folder', 'Mimir Dashboards']);
    });

    it('should return undefined when subScope is not found', () => {
      const folders: SuggestedNavigationsFoldersMap = {
        '': {
          title: '',
          expanded: true,
          folders: {
            'Loki Dashboards': {
              title: 'Loki Dashboards',
              expanded: false,
              folders: {},
              suggestedNavigations: {},
              subScopeName: 'loki',
            },
          },
          suggestedNavigations: {},
        },
      };
      expect(buildSubScopePath('mimir', folders)).toBeUndefined();
    });

    it('should return first match when multiple folders have the same subScope', () => {
      const folders: SuggestedNavigationsFoldersMap = {
        'Mimir Dashboards': {
          title: 'Mimir Dashboards',
          expanded: false,
          folders: {},
          suggestedNavigations: {},
          subScopeName: 'mimir',
        },
        'Mimir Overview': {
          title: 'Mimir Overview',
          expanded: false,
          folders: {},
          suggestedNavigations: {},
          subScopeName: 'mimir',
        },
      };
      // Should return the first one found (order depends on Object.entries)
      const result = buildSubScopePath('mimir', folders);
      expect(result).toBeDefined();
      expect(result?.length).toBe(1);
    });

    it('should find deeply nested subScope', () => {
      const folders: SuggestedNavigationsFoldersMap = {
        level1: {
          title: 'Level 1',
          expanded: true,
          folders: {
            level2: {
              title: 'Level 2',
              expanded: true,
              folders: {
                level3: {
                  title: 'Level 3',
                  expanded: false,
                  folders: {},
                  suggestedNavigations: {},
                  subScopeName: 'deep-scope',
                },
              },
              suggestedNavigations: {},
            },
          },
          suggestedNavigations: {},
        },
      };
      expect(buildSubScopePath('deep-scope', folders)).toEqual(['level1', 'level2', 'level3']);
    });
  });
});
