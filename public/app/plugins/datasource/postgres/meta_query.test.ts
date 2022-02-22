import { describe, expect } from 'test/lib/common';
import { PostgresMetaQuery } from './meta_query';

describe('Postgres MetaQuery', () => {
  describe('buildSchemaConstraint()', () => {
    describe('when executing buildSchemaConstraint()', () => {
      const postgresMetaQuery = new PostgresMetaQuery(null, null);
      it('should return a schema restraint', () => {
        expect(postgresMetaQuery.buildSchemaConstraint()).toEqual(
          `
quote_ident(table_schema) IN (
  SELECT
    CASE WHEN trim(s[i]) = '"$user"' THEN user ELSE trim(s[i]) END
  FROM
    generate_series(
      array_lower(string_to_array(current_setting('search_path'),','),1),
      array_upper(string_to_array(current_setting('search_path'),','),1)
    ) as i,
    string_to_array(current_setting('search_path'),',') s
)`
        );
      });
    });
  });
});
