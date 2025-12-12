import { LOG_LINE_BODY_FIELD_NAME, TABLE_LINE_FIELD_NAME } from 'app/features/logs/components/LogDetailsBody';

import {
  parseLegacyColumns,
  mapLegacyFieldNames,
  mergeWithDefaults,
  hasLegacyColumns,
  extractColumnsValue,
  extractDisplayedFields,
  migrateLegacyColumns,
} from './columnMigration';

describe('columnMigration', () => {
  describe('parseLegacyColumns', () => {
    it('should return null for null input', () => {
      expect(parseLegacyColumns(null)).toBeNull();
    });

    it('should return null for undefined input', () => {
      expect(parseLegacyColumns(undefined)).toBeNull();
    });

    it('should return null for empty array', () => {
      expect(parseLegacyColumns([])).toBeNull();
    });

    it('should return null for empty object', () => {
      expect(parseLegacyColumns({})).toBeNull();
    });

    it('should parse array format correctly', () => {
      const input = ['Time', 'Line', 'level'];
      expect(parseLegacyColumns(input)).toEqual(['Time', 'Line', 'level']);
    });

    it('should parse object format correctly', () => {
      const input = { 0: 'Time', 1: 'Line', 2: 'level' };
      expect(parseLegacyColumns(input)).toEqual(['Time', 'Line', 'level']);
    });

    it('should return null for array with non-string elements', () => {
      const input = ['Time', 123, 'level'];
      expect(parseLegacyColumns(input)).toBeNull();
    });

    it('should return null for object with non-string values', () => {
      const input = { 0: 'Time', 1: 123, 2: 'level' };
      expect(parseLegacyColumns(input)).toBeNull();
    });

    it('should return null for primitive types', () => {
      expect(parseLegacyColumns('string')).toBeNull();
      expect(parseLegacyColumns(123)).toBeNull();
      expect(parseLegacyColumns(true)).toBeNull();
    });

    it('should handle single element array', () => {
      expect(parseLegacyColumns(['Time'])).toEqual(['Time']);
    });

    it('should handle single property object', () => {
      expect(parseLegacyColumns({ 0: 'Time' })).toEqual(['Time']);
    });

    it('should parse real URL format with string numeric keys', () => {
      // Real format from URL: columns%22:%7B%220%22:%22cluster%22,%221%22:%22Line%22,%222%22:%22Time%22%7D
      // Decoded: {"0":"cluster","1":"Line","2":"Time"}
      const input = { '0': 'cluster', '1': 'Line', '2': 'Time' };
      expect(parseLegacyColumns(input)).toEqual(['cluster', 'Line', 'Time']);
    });
  });

  describe('mapLegacyFieldNames', () => {
    it('should map Line to LOG_LINE_BODY_FIELD_NAME', () => {
      const input = [TABLE_LINE_FIELD_NAME];
      expect(mapLegacyFieldNames(input)).toEqual([LOG_LINE_BODY_FIELD_NAME]);
    });

    it('should preserve other field names', () => {
      const input = ['Time', 'level', 'host'];
      expect(mapLegacyFieldNames(input)).toEqual(['Time', 'level', 'host']);
    });

    it('should map Line while preserving other fields', () => {
      const input = ['Time', TABLE_LINE_FIELD_NAME, 'level'];
      expect(mapLegacyFieldNames(input)).toEqual(['Time', LOG_LINE_BODY_FIELD_NAME, 'level']);
    });

    it('should handle empty array', () => {
      expect(mapLegacyFieldNames([])).toEqual([]);
    });

    it('should handle multiple Line fields', () => {
      const input = [TABLE_LINE_FIELD_NAME, TABLE_LINE_FIELD_NAME];
      expect(mapLegacyFieldNames(input)).toEqual([LOG_LINE_BODY_FIELD_NAME, LOG_LINE_BODY_FIELD_NAME]);
    });
  });

  describe('mergeWithDefaults', () => {
    it('should return defaults when migrated columns is empty', () => {
      const defaults = ['Time', 'body'];
      expect(mergeWithDefaults([], defaults)).toEqual(['Time', 'body']);
    });

    it('should return migrated columns when defaults is empty', () => {
      const migrated = ['Time', 'level'];
      expect(mergeWithDefaults(migrated, [])).toEqual(['Time', 'level']);
    });

    it('should place defaults first', () => {
      const migrated = ['level', 'host'];
      const defaults = ['Time', 'body'];
      const result = mergeWithDefaults(migrated, defaults);
      expect(result).toEqual(['Time', 'body', 'level', 'host']);
    });

    it('should not duplicate fields', () => {
      const migrated = ['Time', 'level'];
      const defaults = ['Time', 'body'];
      const result = mergeWithDefaults(migrated, defaults);
      expect(result).toEqual(['Time', 'body', 'level']);
    });

    it('should handle all duplicates', () => {
      const migrated = ['Time', 'body'];
      const defaults = ['Time', 'body'];
      const result = mergeWithDefaults(migrated, defaults);
      expect(result).toEqual(['Time', 'body']);
    });

    it('should preserve order of defaults', () => {
      const migrated = ['host'];
      const defaults = ['body', 'Time', 'level'];
      const result = mergeWithDefaults(migrated, defaults);
      expect(result[0]).toBe('body');
      expect(result[1]).toBe('Time');
      expect(result[2]).toBe('level');
      expect(result[3]).toBe('host');
    });
  });

  describe('hasLegacyColumns', () => {
    it('should return false for null', () => {
      expect(hasLegacyColumns(null)).toBe(false);
    });

    it('should return false for undefined', () => {
      expect(hasLegacyColumns(undefined)).toBe(false);
    });

    it('should return false for non-object', () => {
      expect(hasLegacyColumns('string')).toBe(false);
      expect(hasLegacyColumns(123)).toBe(false);
    });

    it('should return false for object without columns property', () => {
      expect(hasLegacyColumns({ displayedFields: ['Time'] })).toBe(false);
    });

    it('should return true for object with columns property', () => {
      expect(hasLegacyColumns({ columns: ['Time', 'Line'] })).toBe(true);
    });

    it('should return true even if columns is null', () => {
      expect(hasLegacyColumns({ columns: null })).toBe(true);
    });

    it('should return true even if columns is empty', () => {
      expect(hasLegacyColumns({ columns: [] })).toBe(true);
    });
  });

  describe('extractColumnsValue', () => {
    it('should extract columns array', () => {
      const state = { columns: ['Time', 'Line'] };
      expect(extractColumnsValue(state)).toEqual(['Time', 'Line']);
    });

    it('should extract columns object', () => {
      const state = { columns: { 0: 'Time', 1: 'Line' } };
      expect(extractColumnsValue(state)).toEqual({ 0: 'Time', 1: 'Line' });
    });

    it('should return undefined when columns not present', () => {
      const state = { displayedFields: ['Time'] };
      expect(extractColumnsValue(state)).toBeUndefined();
    });
  });

  describe('extractDisplayedFields', () => {
    it('should extract displayedFields array', () => {
      const state = { displayedFields: ['Time', 'level', 'host'] };
      expect(extractDisplayedFields(state)).toEqual(['Time', 'level', 'host']);
    });

    it('should return undefined when displayedFields not present', () => {
      const state = { columns: ['Time'] };
      expect(extractDisplayedFields(state)).toBeUndefined();
    });

    it('should extract empty displayedFields array', () => {
      const state = { displayedFields: [] };
      expect(extractDisplayedFields(state)).toEqual([]);
    });

    it('should handle state with both columns and displayedFields', () => {
      const state = {
        columns: { '0': 'cluster', '1': 'Line' },
        displayedFields: ['service_name', 'component'],
      };
      expect(extractDisplayedFields(state)).toEqual(['service_name', 'component']);
    });
  });

  describe('migrateLegacyColumns', () => {
    const defaultDisplayedFields = ['Time', LOG_LINE_BODY_FIELD_NAME];

    describe('general behavior', () => {
      it('should return null when logsState is null', () => {
        expect(migrateLegacyColumns(null, defaultDisplayedFields, 'table')).toBeNull();
      });

      it('should return null when logsState is undefined', () => {
        expect(migrateLegacyColumns(undefined, defaultDisplayedFields, 'table')).toBeNull();
      });

      it('should return null when no columns property exists', () => {
        const logsState = { displayedFields: ['Time'] };
        expect(migrateLegacyColumns(logsState, defaultDisplayedFields, 'table')).toBeNull();
      });

      it('should return null when visualisationType is not provided', () => {
        const logsState = { columns: ['Time', 'level'] };
        expect(migrateLegacyColumns(logsState, defaultDisplayedFields)).toBeNull();
      });

      it('should return null when visualisationType is unknown', () => {
        const logsState = { columns: ['Time', 'level'] };
        expect(migrateLegacyColumns(logsState, defaultDisplayedFields, 'unknown')).toBeNull();
      });
    });

    describe('visualisationType: table', () => {
      it('should return null when columns is empty array', () => {
        const logsState = { columns: [] };
        expect(migrateLegacyColumns(logsState, defaultDisplayedFields, 'table')).toBeNull();
      });

      it('should return null when columns is invalid', () => {
        const logsState = { columns: 'invalid' };
        expect(migrateLegacyColumns(logsState, defaultDisplayedFields, 'table')).toBeNull();
      });

      it('should migrate array format columns', () => {
        const logsState = { columns: ['Time', TABLE_LINE_FIELD_NAME, 'level'] };
        const result = migrateLegacyColumns(logsState, defaultDisplayedFields, 'table');
        expect(result).toEqual(['Time', LOG_LINE_BODY_FIELD_NAME, 'level']);
      });

      it('should migrate object format columns', () => {
        const logsState = { columns: { 0: 'Time', 1: TABLE_LINE_FIELD_NAME, 2: 'level' } };
        const result = migrateLegacyColumns(logsState, defaultDisplayedFields, 'table');
        expect(result).toEqual(['Time', LOG_LINE_BODY_FIELD_NAME, 'level']);
      });

      it('should return only mapped columns without merging with defaults', () => {
        const logsState = { columns: ['level', 'host'] };
        const result = migrateLegacyColumns(logsState, defaultDisplayedFields, 'table');
        // Table visualization returns only the columns, not merged with defaults
        expect(result).toEqual(['level', 'host']);
      });

      it('should map Line to body field name', () => {
        const logsState = { columns: [TABLE_LINE_FIELD_NAME] };
        const result = migrateLegacyColumns(logsState, defaultDisplayedFields, 'table');
        expect(result).toEqual([LOG_LINE_BODY_FIELD_NAME]);
      });

      it('should map timestamp to Time', () => {
        const logsState = { columns: ['timestamp', 'level'] };
        const result = migrateLegacyColumns(logsState, defaultDisplayedFields, 'table');
        expect(result).toEqual(['Time', 'level']);
      });

      it('should map body to LOG_LINE_BODY_FIELD_NAME', () => {
        const logsState = { columns: ['body', 'level'] };
        const result = migrateLegacyColumns(logsState, defaultDisplayedFields, 'table');
        expect(result).toEqual([LOG_LINE_BODY_FIELD_NAME, 'level']);
      });

      it('should ignore displayedFields and only use columns for table', () => {
        const logsState = {
          columns: ['level'],
          displayedFields: ['existing', 'fields'],
        };
        const result = migrateLegacyColumns(logsState, defaultDisplayedFields, 'table');
        // Should only return mapped columns, ignoring displayedFields
        expect(result).toEqual(['level']);
      });

      it('should handle real URL format with full logsState structure', () => {
        const logsState = {
          columns: { '0': 'cluster', '1': 'Line', '2': 'Time' },
          visualisationType: 'table',
          labelFieldName: 'labels',
          refId: 'A',
        };
        const result = migrateLegacyColumns(logsState, defaultDisplayedFields, 'table');
        // Returns mapped columns in order (Line -> LOG_LINE_BODY_FIELD_NAME)
        expect(result).toEqual(['cluster', LOG_LINE_BODY_FIELD_NAME, 'Time']);
      });

      it('should migrate columns from real Grafana Explore URL', () => {
        const logsState = {
          sortOrder: 'Ascending',
          columns: { '0': 'cluster', '1': 'Line', '2': 'Time' },
          visualisationType: 'table',
          labelFieldName: 'labels',
          refId: 'A',
        };
        const result = migrateLegacyColumns(logsState, defaultDisplayedFields, 'table');
        expect(result).toContain('cluster');
        expect(result).toContain(LOG_LINE_BODY_FIELD_NAME);
        expect(result).toContain('Time');
        expect(result).not.toContain('Line'); // Line should be mapped
      });

      it('should map legacy field names correctly', () => {
        const logsState = {
          columns: { '0': 'timestamp', '1': 'body', '2': 'env', '3': 'namespace' },
        };
        const result = migrateLegacyColumns(logsState, defaultDisplayedFields, 'table');
        expect(result).toEqual(['Time', LOG_LINE_BODY_FIELD_NAME, 'env', 'namespace']);
      });
    });

    describe('visualisationType: logs', () => {
      it('should return null when no columns property exists (required for migration)', () => {
        const logsState = { displayedFields: ['Time', 'level'] };
        // logs visualization requires legacy columns to exist for migration to run
        expect(migrateLegacyColumns(logsState, defaultDisplayedFields, 'logs')).toBeNull();
      });

      it('should return displayedFields directly when columns exist', () => {
        const logsState = {
          columns: { '0': 'old', '1': 'columns' }, // Legacy columns must exist
          displayedFields: ['Time', 'level', 'host'],
        };
        const result = migrateLegacyColumns(logsState, defaultDisplayedFields, 'logs');
        expect(result).toEqual(['Time', 'level', 'host']);
      });

      it('should return null when displayedFields is empty', () => {
        const logsState = {
          columns: { '0': 'old' },
          displayedFields: [],
        };
        expect(migrateLegacyColumns(logsState, defaultDisplayedFields, 'logs')).toBeNull();
      });

      it('should return null when displayedFields is not an array', () => {
        const logsState = {
          columns: { '0': 'old' },
          displayedFields: 'not-an-array',
        };
        expect(migrateLegacyColumns(logsState, defaultDisplayedFields, 'logs')).toBeNull();
      });

      it('should ignore columns and use displayedFields for logs visualization', () => {
        const logsState = {
          columns: { '0': 'cluster', '1': 'Line', '2': 'Time' },
          displayedFields: ['service_name', 'component'],
        };
        const result = migrateLegacyColumns(logsState, defaultDisplayedFields, 'logs');
        // Should return displayedFields, ignoring columns
        expect(result).toEqual(['service_name', 'component']);
      });
    });
  });
});
