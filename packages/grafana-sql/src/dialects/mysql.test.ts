import { MYSQL_RESERVED_WORDS, mysqlIdentifier } from './mysql';

describe('mysqlIdentifier', () => {
  describe('isValidIdentifier', () => {
    it('should return true for simple valid identifiers', () => {
      expect(mysqlIdentifier.isValidIdentifier('foo')).toBe(true);
      expect(mysqlIdentifier.isValidIdentifier('_bar')).toBe(true);
      expect(mysqlIdentifier.isValidIdentifier('baz123')).toBe(true);
      expect(mysqlIdentifier.isValidIdentifier('col_$name')).toBe(true);
    });

    it('should return false for identifiers starting with a digit', () => {
      expect(mysqlIdentifier.isValidIdentifier('1foo')).toBe(false);
      expect(mysqlIdentifier.isValidIdentifier('123')).toBe(false);
    });

    it('should return false for identifiers containing spaces', () => {
      expect(mysqlIdentifier.isValidIdentifier('foo bar')).toBe(false);
    });

    it('should return false for identifiers containing special characters', () => {
      expect(mysqlIdentifier.isValidIdentifier('foo-bar')).toBe(false);
      expect(mysqlIdentifier.isValidIdentifier('foo@bar')).toBe(false);
      expect(mysqlIdentifier.isValidIdentifier('foo`bar')).toBe(false);
    });

    it('should return false for reserved words', () => {
      expect(mysqlIdentifier.isValidIdentifier('SELECT')).toBe(false);
      expect(mysqlIdentifier.isValidIdentifier('FROM')).toBe(false);
      expect(mysqlIdentifier.isValidIdentifier('TABLE')).toBe(false);
    });

    it('should be case-insensitive for reserved words', () => {
      expect(mysqlIdentifier.isValidIdentifier('select')).toBe(false);
      expect(mysqlIdentifier.isValidIdentifier('Select')).toBe(false);
      expect(mysqlIdentifier.isValidIdentifier('from')).toBe(false);
    });

    it('should return false for empty string', () => {
      expect(mysqlIdentifier.isValidIdentifier('')).toBe(false);
    });
  });

  describe('quoteIdentifierIfNecessary', () => {
    it('should not quote valid identifiers', () => {
      expect(mysqlIdentifier.quoteIdentifierIfNecessary('foo')).toBe('foo');
      expect(mysqlIdentifier.quoteIdentifierIfNecessary('_bar')).toBe('_bar');
    });

    it('should quote identifiers with spaces', () => {
      expect(mysqlIdentifier.quoteIdentifierIfNecessary('foo bar')).toBe('`foo bar`');
    });

    it('should quote reserved words', () => {
      expect(mysqlIdentifier.quoteIdentifierIfNecessary('SELECT')).toBe('`SELECT`');
      expect(mysqlIdentifier.quoteIdentifierIfNecessary('FROM')).toBe('`FROM`');
    });

    it('should be idempotent for already-quoted identifiers', () => {
      expect(mysqlIdentifier.quoteIdentifierIfNecessary('`foo`')).toBe('`foo`');
      expect(mysqlIdentifier.quoteIdentifierIfNecessary('`foo bar`')).toBe('`foo bar`');
      expect(mysqlIdentifier.quoteIdentifierIfNecessary('`SELECT`')).toBe('`SELECT`');
    });

    it('should escape embedded backticks by doubling them', () => {
      expect(mysqlIdentifier.quoteIdentifierIfNecessary('foo`bar')).toBe('`foo``bar`');
      expect(mysqlIdentifier.quoteIdentifierIfNecessary('a`b`c')).toBe('`a``b``c`');
    });

    it('should handle empty string', () => {
      expect(mysqlIdentifier.quoteIdentifierIfNecessary('')).toBe('``');
    });
  });

  describe('unquoteIdentifier', () => {
    it('should remove backtick quoting', () => {
      expect(mysqlIdentifier.unquoteIdentifier('`foo`')).toBe('foo');
      expect(mysqlIdentifier.unquoteIdentifier('`foo bar`')).toBe('foo bar');
    });

    it('should remove double-quote quoting', () => {
      expect(mysqlIdentifier.unquoteIdentifier('"foo"')).toBe('foo');
      expect(mysqlIdentifier.unquoteIdentifier('"foo bar"')).toBe('foo bar');
    });

    it('should handle doubled delimiter escapes', () => {
      expect(mysqlIdentifier.unquoteIdentifier('`foo``bar`')).toBe('foo`bar');
      expect(mysqlIdentifier.unquoteIdentifier('"foo""bar"')).toBe('foo"bar');
    });

    it('should return unquoted identifiers unchanged', () => {
      expect(mysqlIdentifier.unquoteIdentifier('foo')).toBe('foo');
      expect(mysqlIdentifier.unquoteIdentifier('foo bar')).toBe('foo bar');
    });

    it('should handle empty string', () => {
      expect(mysqlIdentifier.unquoteIdentifier('')).toBe('');
    });

    it('should handle single-character strings', () => {
      expect(mysqlIdentifier.unquoteIdentifier('`')).toBe('`');
      expect(mysqlIdentifier.unquoteIdentifier('"')).toBe('"');
    });
  });
});

describe('MYSQL_RESERVED_WORDS', () => {
  it('should contain expected reserved words', () => {
    expect(MYSQL_RESERVED_WORDS).toContain('SELECT');
    expect(MYSQL_RESERVED_WORDS).toContain('FROM');
    expect(MYSQL_RESERVED_WORDS).toContain('WHERE');
    expect(MYSQL_RESERVED_WORDS).toContain('TABLE');
  });
});
