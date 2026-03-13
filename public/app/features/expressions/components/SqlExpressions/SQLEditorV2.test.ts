import { Text } from '@codemirror/state';

import { getFromTables, isAfterFromOrJoin } from './SQLEditorV2';

describe('isAfterFromOrJoin', () => {
  function check(text: string, pos?: number) {
    const doc = Text.of(text.split('\n'));
    return isAfterFromOrJoin(doc, pos ?? text.length);
  }

  it('returns true directly after FROM', () => {
    expect(check('SELECT * FROM ')).toBe(true);
  });

  it('returns true directly after JOIN', () => {
    expect(check('SELECT * FROM A JOIN ')).toBe(true);
  });

  it('returns true when typing a table name after FROM', () => {
    expect(check('SELECT * FROM A', 'SELECT * FROM A'.length)).toBe(true);
  });

  it('returns true after a comma in a FROM list', () => {
    expect(check('FROM A, ')).toBe(true);
  });

  it('returns true when typing after a comma in a FROM list', () => {
    expect(check('FROM A, B')).toBe(true);
  });

  it('returns true with multiline FROM and comma', () => {
    expect(check('SELECT *\nFROM\n  A, ')).toBe(true);
  });

  it('returns false in SELECT clause', () => {
    expect(check('SELECT ')).toBe(false);
  });

  it('returns false in WHERE clause', () => {
    expect(check('SELECT * FROM A WHERE ')).toBe(false);
  });

  it('returns false after LIMIT', () => {
    expect(check('SELECT * FROM A LIMIT ')).toBe(false);
  });

  it('is case-insensitive', () => {
    expect(check('select * from ')).toBe(true);
    expect(check('select * from a, ')).toBe(true);
    expect(check('select * from A join ')).toBe(true);
  });
});

describe('getFromTables', () => {
  function check(text: string) {
    const doc = Text.of(text.split('\n'));
    return getFromTables(doc);
  }

  it('extracts a single table', () => {
    expect(check('SELECT * FROM A')).toEqual(['A']);
  });

  it('extracts comma-separated tables', () => {
    expect(check('SELECT * FROM A, B, C')).toEqual(['A', 'B', 'C']);
  });

  it('extracts tables with whitespace around commas', () => {
    expect(check('SELECT * FROM A , B , C')).toEqual(['A', 'B', 'C']);
  });

  it('extracts tables from multiline FROM clause', () => {
    expect(check('SELECT *\nFROM\n  A,\n  B')).toEqual(['A', 'B']);
  });

  it('deduplicates table names', () => {
    expect(check('SELECT * FROM A, A')).toEqual(['A']);
  });

  it('returns empty array when no FROM clause', () => {
    expect(check('SELECT 1')).toEqual([]);
  });

  it('is case-insensitive for FROM keyword', () => {
    expect(check('select * from A, B')).toEqual(['A', 'B']);
  });

  it('stops at SQL keywords after table list', () => {
    expect(check('SELECT * FROM A, B WHERE x = 1')).toEqual(['A', 'B']);
  });
});
