import { QueryFormat, SQLQuery } from '@grafana/sql';

import { migrateVariableQuery } from './migrations';

describe('migrateVariableQuery', () => {
  describe('when given a string query (legacy format)', () => {
    it('should convert to SQLQuery format with rawSql and query fields', () => {
      const result = migrateVariableQuery('SELECT hostname FROM hosts');

      expect(result.rawSql).toBe('SELECT hostname FROM hosts');
      expect(result.query).toBe('SELECT hostname FROM hosts');
      expect(result.refId).toBe('SQLVariableQueryEditor-VariableQuery');
    });

    it('should handle empty string', () => {
      const result = migrateVariableQuery('');

      expect(result.rawSql).toBe('');
      expect(result.query).toBe('');
    });

    it('should handle complex SQL queries', () => {
      const complexQuery = `SELECT hostname AS __text, id AS __value FROM hosts WHERE region = 'us-east-1'`;
      const result = migrateVariableQuery(complexQuery);

      expect(result.rawSql).toBe(complexQuery);
      expect(result.query).toBe(complexQuery);
    });
  });

  describe('when given an SQLQuery object', () => {
    it('should preserve the rawSql and add query field', () => {
      const sqlQuery = {
        refId: 'A',
        rawSql: 'SELECT id FROM table',
      };
      const result = migrateVariableQuery(sqlQuery);

      expect(result.rawSql).toBe('SELECT id FROM table');
      expect(result.query).toBe('SELECT id FROM table');
      expect(result.refId).toBe('A');
    });

    it('should handle SQLQuery with empty rawSql', () => {
      const sqlQuery = {
        refId: 'A',
        rawSql: '',
      };
      const result = migrateVariableQuery(sqlQuery);

      expect(result.rawSql).toBe('');
      expect(result.query).toBe('');
    });

    it('should handle SQLQuery without rawSql', () => {
      const sqlQuery = {
        refId: 'A',
      };
      const result = migrateVariableQuery(sqlQuery);

      expect(result.query).toBe('');
    });

    it('should preserve all existing SQLQuery properties', () => {
      const sqlQuery: SQLQuery = {
        refId: 'B',
        rawSql: 'SELECT * FROM users',
        format: QueryFormat.Table,
        table: 'users',
        dataset: 'mydb',
      };
      const result = migrateVariableQuery(sqlQuery);

      expect(result.refId).toBe('B');
      expect(result.rawSql).toBe('SELECT * FROM users');
      expect(result.query).toBe('SELECT * FROM users');
      expect(result.format).toBe(QueryFormat.Table);
      expect(result.table).toBe('users');
      expect(result.dataset).toBe('mydb');
    });
  });
});
