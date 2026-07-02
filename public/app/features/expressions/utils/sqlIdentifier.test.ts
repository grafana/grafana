import { quoteIdentifierIfNecessary, unquoteIdentifier } from './sqlIdentifier';

describe('quoteIdentifierIfNecessary', () => {
  it('leaves plain identifiers unquoted', () => {
    expect(quoteIdentifierIfNecessary('A', 'mysql')).toBe('A');
    expect(quoteIdentifierIfNecessary('table_1', 'mysql')).toBe('table_1');
    expect(quoteIdentifierIfNecessary('_private$col', 'mysql')).toBe('_private$col');
  });

  it('quotes names with spaces or special characters using the dialect quote character', () => {
    expect(quoteIdentifierIfNecessary('table A', 'mysql')).toBe('`table A`');
    expect(quoteIdentifierIfNecessary('table A', 'standard')).toBe('"table A"');
    expect(quoteIdentifierIfNecessary('1abc', 'mysql')).toBe('`1abc`');
    expect(quoteIdentifierIfNecessary('a-b', 'standard')).toBe('"a-b"');
  });

  it('applies dialect-specific unquoted-identifier rules', () => {
    // `$` is a valid unquoted character in MySQL but not in standard SQL.
    expect(quoteIdentifierIfNecessary('col$', 'mysql')).toBe('col$');
    expect(quoteIdentifierIfNecessary('col$', 'standard')).toBe('"col$"');
  });

  it('escapes embedded quote characters by doubling them', () => {
    expect(quoteIdentifierIfNecessary('we`ird', 'mysql')).toBe('`we``ird`');
    expect(quoteIdentifierIfNecessary('we"ird', 'standard')).toBe('"we""ird"');
  });
});

describe('unquoteIdentifier', () => {
  it('returns plain identifiers unchanged', () => {
    expect(unquoteIdentifier('table', 'mysql')).toBe('table');
  });

  it('trims surrounding whitespace', () => {
    expect(unquoteIdentifier('  table  ', 'mysql')).toBe('table');
  });

  it('strips the dialect quote characters', () => {
    expect(unquoteIdentifier('`table A`', 'mysql')).toBe('table A');
    expect(unquoteIdentifier('"table A"', 'standard')).toBe('table A');
  });

  it('unescapes doubled quote characters', () => {
    expect(unquoteIdentifier('`table ``A```', 'mysql')).toBe('table `A`');
    expect(unquoteIdentifier('"table ""A"""', 'standard')).toBe('table "A"');
  });

  it('does not treat another dialect quote as an identifier delimiter', () => {
    // In MySQL, double quotes delimit a string literal, not an identifier, so they are left intact.
    expect(unquoteIdentifier('"table A"', 'mysql')).toBe('"table A"');
    expect(unquoteIdentifier('`table A`', 'standard')).toBe('`table A`');
  });

  it('leaves mismatched or partial quotes untouched', () => {
    expect(unquoteIdentifier('`table A', 'mysql')).toBe('`table A');
    expect(unquoteIdentifier('`', 'mysql')).toBe('`');
  });
});
