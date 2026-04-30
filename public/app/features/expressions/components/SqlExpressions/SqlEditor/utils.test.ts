import { CompletionContext } from '@codemirror/autocomplete';
import { EditorState } from '@codemirror/state';

import {
  getFromTables,
  getQualifiedColumnContext,
  getSqlCompletionSource,
  isClauseCompletionPosition,
  isTableCompletionPosition,
  type SqlCompletionProvider,
} from './utils';

const getCompletionResult = (completionProvider: SqlCompletionProvider, sql: string, pos = sql.length) => {
  const completionSource = getSqlCompletionSource(completionProvider);
  const context = new CompletionContext(EditorState.create({ doc: sql }), pos, true);

  return completionSource(context);
};

describe('SQL editor completion utils', () => {
  it('finds table refs in from and join clauses', () => {
    expect(getFromTables('SELECT * FROM A AS a JOIN B b ON a.time = b.time WHERE a.value > 0')).toEqual(['A', 'B']);
  });

  it('detects table completion positions', () => {
    expect(isTableCompletionPosition('SELECT * FROM ')).toBe(true);
    expect(isTableCompletionPosition('SELECT * FROM A, ')).toBe(true);
    expect(isTableCompletionPosition('SELECT * FROM A WHERE ')).toBe(false);
  });

  it('detects clause completion positions after a table ref', () => {
    expect(isClauseCompletionPosition('SELECT * FROM A ')).toBe(true);
    expect(isClauseCompletionPosition('SELECT * FROM ')).toBe(false);
    expect(isClauseCompletionPosition('SELECT * FROM A WHERE ')).toBe(false);
  });

  it('finds qualified column completion context', () => {
    expect(getQualifiedColumnContext('SELECT A.')).toEqual({ table: 'A', from: 9 });
    expect(getQualifiedColumnContext('SELECT value')).toBeUndefined();
  });

  it.each([
    ['direct table refs', 'SELECT A. FROM A', 'SELECT A.'.length, 'A'],
    ['AS aliases', 'SELECT a. FROM A AS a', 'SELECT a.'.length, 'A'],
    ['bare aliases', 'SELECT a. FROM A a', 'SELECT a.'.length, 'A'],
    ['joined aliases', 'SELECT b. FROM A a JOIN B b ON a.time = b.time', 'SELECT b.'.length, 'B'],
  ])('resolves columns for %s in qualified column completions', async (_name, sql, pos, table) => {
    const columns = jest.fn().mockReturnValue([{ label: 'value', insertText: 'value' }]);
    const result = await getCompletionResult(
      {
        tables: () => [
          { label: 'A', insertText: 'A' },
          { label: 'B', insertText: 'B' },
        ],
        columns,
      },
      sql,
      pos
    );

    expect(columns).toHaveBeenCalledWith({ table });
    expect(result).toEqual(
      expect.objectContaining({
        options: expect.arrayContaining([expect.objectContaining({ label: 'value' })]),
      })
    );
  });
});
