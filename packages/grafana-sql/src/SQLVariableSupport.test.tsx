import { Field, FieldType } from '@grafana/data';
import { EditorMode } from '@grafana/plugin-ui';

import { migrateVariableQuery, convertOriginalFieldsToVariableFields } from './SQLVariableSupport';
import { QueryFormat, SQLQuery, SQLQueryMeta } from './types';

const refId = 'SQLVariableQueryEditor-VariableQuery';
const sampleQuery = 'SELECT * FROM users';

describe('migrateVariableQuery', () => {
  it('should handle string query', () => {
    const result = migrateVariableQuery(sampleQuery);
    expect(result).toMatchObject({
      refId,
      rawSql: sampleQuery,
      query: sampleQuery,
      editorMode: EditorMode.Code,
      format: QueryFormat.Table,
    });
  });
  it('should handle empty string query', () => {
    const result = migrateVariableQuery('');
    expect(result).toMatchObject({
      refId,
      rawSql: '',
      query: '',
      editorMode: EditorMode.Builder,
      format: QueryFormat.Table,
    });
  });
  it('should handle SQLQuery object with rawSql', () => {
    const rawQuery: SQLQuery = {
      refId: 'A',
      rawSql: sampleQuery,
      format: QueryFormat.Timeseries,
      editorMode: EditorMode.Code,
    };
    const result = migrateVariableQuery(rawQuery);
    expect(result).toStrictEqual({ ...rawQuery, query: sampleQuery });
  });
  it('should preserve all other properties from SQLQuery', () => {
    const rawQuery: SQLQuery = {
      refId: 'C',
      rawSql: sampleQuery,
      alias: 'test_alias',
      dataset: 'test_dataset',
      table: 'test_table',
      meta: { textField: 'name', valueField: 'id' },
    };
    const result = migrateVariableQuery(rawQuery);
    expect(result).toStrictEqual({ ...rawQuery, query: sampleQuery });
  });
});

const field = (name: string, type: FieldType = FieldType.string, values: unknown[] = [1, 2, 3]): Field => ({
  name,
  type,
  values,
  config: {},
});

describe('convertOriginalFieldsToVariableFields', () => {
  it('should throw error when no fields provided', () => {
    expect(() => convertOriginalFieldsToVariableFields([])).toThrow('at least one field expected for variable');
  });

  it('should handle fields with __text and __value names', () => {
    const fields = [field('__text'), field('__value'), field('other_field')];
    expect(convertOriginalFieldsToVariableFields(fields).map((r) => r.name)).toStrictEqual([
      'text',
      'value',
      '__text',
      '__value',
      'other_field',
    ]);
  });

  it('should handle fields with only __text', () => {
    const fields = [field('__text'), field('other_field')];
    expect(convertOriginalFieldsToVariableFields(fields).map((r) => r.name)).toStrictEqual([
      'text',
      'value',
      '__text',
      'other_field',
    ]);
  });

  it('should handle fields with only __value', () => {
    const fields = [field('__value'), field('other_field')];
    expect(convertOriginalFieldsToVariableFields(fields).map((r) => r.name)).toStrictEqual([
      'text',
      'value',
      '__value',
      'other_field',
    ]);
  });

  it('should use first field when no __text or __value present', () => {
    const fields = [field('id'), field('name'), field('category')];
    expect(convertOriginalFieldsToVariableFields(fields).map((r) => r.name)).toStrictEqual([
      'text',
      'value',
      'id',
      'name',
      'category',
    ]);
  });

  it('should respect meta.textField and meta.valueField', () => {
    const fields = [field('id', FieldType.number, [3, 4]), field('display_name'), field('category')];
    const meta: SQLQueryMeta = {
      textField: 'display_name',
      valueField: 'id',
    };
    const result = convertOriginalFieldsToVariableFields(fields, meta);
    expect(convertOriginalFieldsToVariableFields(fields).map((r) => r.name)).toStrictEqual([
      'text',
      'value',
      'id',
      'display_name',
      'category',
    ]);
    expect(result[0]).toStrictEqual({ ...fields[1], name: 'text' }); // display_name -> text
    expect(result[1]).toStrictEqual({ ...fields[0], name: 'value' }); // id -> value
  });

  it('should handle meta with non-existent field names', () => {
    const fields = [field('id'), field('name')];
    const meta: SQLQueryMeta = {
      textField: 'non_existent_field',
      valueField: 'also_non_existent',
    };
    const result = convertOriginalFieldsToVariableFields(fields, meta);
    expect(result.map((r) => r.name)).toStrictEqual(['text', 'value', 'id', 'name']);
    expect(result[0]).toStrictEqual({ ...fields[0], name: 'text' });
    expect(result[1]).toStrictEqual({ ...fields[0], name: 'value' });
  });

  it('should handle partial meta (only textField)', () => {
    const fields = [field('id'), field('label'), field('description')];
    const meta: SQLQueryMeta = {
      textField: 'label',
    };
    const result = convertOriginalFieldsToVariableFields(fields, meta);
    expect(result.map((r) => r.name)).toStrictEqual(['text', 'value', 'id', 'label', 'description']);
    expect(result[0]).toStrictEqual({ ...fields[1], name: 'text' }); // label -> text
    expect(result[1]).toStrictEqual({ ...fields[0], name: 'value' }); // fallback to text field
  });

  it('should handle partial meta (only valueField)', () => {
    const fields = [field('name'), field('id', FieldType.number), field('type')];
    const meta: SQLQueryMeta = {
      valueField: 'id',
    };
    const result = convertOriginalFieldsToVariableFields(fields, meta);
    expect(result.map((r) => r.name)).toStrictEqual(['text', 'value', 'name', 'id', 'type']);
    expect(result[0]).toStrictEqual({ ...fields[0], name: 'text', type: FieldType.number }); // fallback to value field
    expect(result[1]).toStrictEqual({ ...fields[1], name: 'value' }); // id -> value
  });

  it('should not include duplicate "value" or "text" fields in otherFields', () => {
    const fields = [field('value'), field('text'), field('other')];
    expect(convertOriginalFieldsToVariableFields(fields).map((r) => r.name)).toStrictEqual(['text', 'value', 'other']);
  });

  it('should preserve field types and configurations', () => {
    const fields = [
      {
        name: 'id',
        type: FieldType.number,
        config: { unit: 'short', displayName: 'ID' },
        values: [1, 2, 3],
      },
      {
        name: 'name',
        type: FieldType.string,
        config: { displayName: 'Name' },
        values: ['A', 'B', 'C'],
      },
    ];
    const meta: SQLQueryMeta = {
      textField: 'name',
      valueField: 'id',
    };
    const result = convertOriginalFieldsToVariableFields(fields, meta);
    expect(result[0]).toStrictEqual({
      name: 'text',
      type: FieldType.string,
      config: { displayName: 'Name' },
      values: ['A', 'B', 'C'],
    });
    expect(result[1]).toStrictEqual({
      name: 'value',
      type: FieldType.number,
      config: { unit: 'short', displayName: 'ID' },
      values: [1, 2, 3],
    });
  });
});
