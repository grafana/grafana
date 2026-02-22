import { FieldType } from '@grafana/data';

import {
  convertFieldsToVariableFields,
  migrateVariableQuery,
  refId,
  updateFrame,
} from './ElasticsearchVariableUtils';
import { ElasticsearchDataQuery } from './dataquery.gen';

describe('ElasticsearchVariableUtils', () => {
  describe('migrateVariableQuery', () => {
    it('should migrate string query to variable query', () => {
      const result = migrateVariableQuery('test query');

      expect(result).toEqual({
        refId,
        query: 'test query',
        metrics: [{ type: 'raw_document', id: '1' }],
      });
    });

    it('should migrate ElasticsearchDataQuery with refId', () => {
      const query: ElasticsearchDataQuery = {
        refId: 'A',
        query: 'test',
        metrics: [{ type: 'count', id: '1' }],
      };

      const result = migrateVariableQuery(query);

      expect(result).toEqual({
        ...query,
        refId: 'A',
        query: 'test',
        meta: undefined,
      });
    });

    it('should use default refId when not provided', () => {
      const query: ElasticsearchDataQuery = {
        refId: '',
        query: 'test',
      };

      const result = migrateVariableQuery(query);

      expect(result.refId).toBe(refId);
    });

    it('should preserve meta field', () => {
      const query: ElasticsearchDataQuery = {
        refId: 'A',
        query: 'test',
        meta: {
          textField: 'name',
          valueField: 'id',
        },
      };

      const result = migrateVariableQuery(query);

      expect(result.meta).toEqual({
        textField: 'name',
        valueField: 'id',
      });
    });

    it('should use empty string for query if not provided', () => {
      const query: ElasticsearchDataQuery = {
        refId: 'A',
      };

      const result = migrateVariableQuery(query);

      expect(result.query).toBe('');
    });
  });

  describe('convertFieldsToVariableFields', () => {
    it('should throw error when no fields provided', () => {
      expect(() => convertFieldsToVariableFields([])).toThrow('at least one field expected for variable');
    });

    it('should use meta fields when provided', () => {
      const fields = [
        { name: 'id', type: FieldType.number, config: {}, values: [1, 2, 3] },
        { name: 'name', type: FieldType.string, config: {}, values: ['a', 'b', 'c'] },
        { name: 'other', type: FieldType.string, config: {}, values: ['x', 'y', 'z'] },
      ];

      const result = convertFieldsToVariableFields(fields, {
        textField: 'name',
        valueField: 'id',
      });

      expect(result.length).toBeGreaterThanOrEqual(3);
      expect(result[0].name).toBe('text');
      expect(result[0].values).toEqual(['a', 'b', 'c']);
      expect(result[1].name).toBe('value');
      expect(result[1].values).toEqual([1, 2, 3]);
      // Other fields are preserved
      expect(result.some((f) => f.name === 'other')).toBe(true);
    });

    it('should use textField for both when valueField not specified', () => {
      const fields = [
        { name: 'name', type: FieldType.string, config: {}, values: ['a', 'b'] },
        { name: 'other', type: FieldType.string, config: {}, values: ['x', 'y'] },
      ];

      const result = convertFieldsToVariableFields(fields, {
        textField: 'name',
      });

      expect(result[0].name).toBe('text');
      expect(result[0].values).toEqual(['a', 'b']);
      expect(result[1].name).toBe('value');
      expect(result[1].values).toEqual(['a', 'b']);
    });

    it('should use first field when meta fields not found', () => {
      const fields = [
        { name: 'id', type: FieldType.number, config: {}, values: [1, 2] },
        { name: 'name', type: FieldType.string, config: {}, values: ['a', 'b'] },
      ];

      const result = convertFieldsToVariableFields(fields, {
        textField: 'notfound',
        valueField: 'alsonotfound',
      });

      expect(result[0].name).toBe('text');
      expect(result[0].values).toEqual([1, 2]);
      expect(result[1].name).toBe('value');
      expect(result[1].values).toEqual([1, 2]);
    });

    it('should handle __text and __value fields', () => {
      const fields = [
        { name: '__text', type: FieldType.string, config: {}, values: ['a', 'b'] },
        { name: '__value', type: FieldType.string, config: {}, values: [1, 2] },
        { name: 'other', type: FieldType.string, config: {}, values: ['x', 'y'] },
      ];

      const result = convertFieldsToVariableFields(fields);

      expect(result).toHaveLength(3);
      expect(result[0].name).toBe('text');
      expect(result[0].values).toEqual(['a', 'b']);
      expect(result[1].name).toBe('value');
      expect(result[1].values).toEqual(['1', '2']);
      expect(result[2].name).toBe('other');
    });

    it('should fallback to combining all fields into single value', () => {
      const fields = [
        { name: 'field1', type: FieldType.string, config: {}, values: ['a', 'b'] },
        { name: 'field2', type: FieldType.string, config: {}, values: ['c', 'd'] },
      ];

      const result = convertFieldsToVariableFields(fields);

      expect(result).toHaveLength(2);
      expect(result[0].name).toBe('text');
      expect(result[1].name).toBe('value');
      expect(result[0].values).toEqual(['a', 'b', 'c', 'd']);
      expect(result[1].values).toEqual(['a', 'b', 'c', 'd']);
    });

    it('should skip null and undefined values in fallback', () => {
      const fields = [
        { name: 'field1', type: FieldType.string, config: {}, values: ['a', null, 'b', undefined, 'c'] },
      ];

      const result = convertFieldsToVariableFields(fields);

      expect(result[0].values).toEqual(['a', 'b', 'c']);
    });

    it('should deduplicate values in fallback', () => {
      const fields = [
        { name: 'field1', type: FieldType.string, config: {}, values: ['a', 'b', 'a'] },
        { name: 'field2', type: FieldType.string, config: {}, values: ['b', 'c'] },
      ];

      const result = convertFieldsToVariableFields(fields);

      expect(result[0].values).toEqual(['a', 'b', 'c']);
    });
  });

  describe('updateFrame', () => {
    it('should update frame with converted fields', () => {
      const frame = {
        name: 'test',
        refId: 'A',
        length: 2,
        fields: [
          { name: 'id', type: FieldType.number, config: {}, values: [1, 2] },
          { name: 'name', type: FieldType.string, config: {}, values: ['a', 'b'] },
        ],
      };

      const result = updateFrame(frame, {
        textField: 'name',
        valueField: 'id',
      });

      expect(result.fields.length).toBeGreaterThanOrEqual(2);
      expect(result.fields[0].name).toBe('text');
      expect(result.fields[1].name).toBe('value');
      expect(result.length).toBe(2);
    });

    it('should handle empty frame', () => {
      const frame = {
        name: 'test',
        refId: 'A',
        length: 0,
        fields: [],
      };

      expect(() => updateFrame(frame)).toThrow('at least one field expected for variable');
    });
  });
});
