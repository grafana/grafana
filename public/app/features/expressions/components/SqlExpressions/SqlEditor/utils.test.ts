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

  it('resolves columns for direct table refs in qualified column completions', async () => {
    const columns = jest.fn().mockReturnValue([{ label: 'value', insertText: 'value' }]);
    const result = await getCompletionResult(
      { tables: () => [{ label: 'A', insertText: 'A' }], columns },
      'SELECT A. FROM A',
      'SELECT A.'.length
    );

    expect(columns).toHaveBeenCalledWith({ table: 'A' });
    expect(result).toEqual(
      expect.objectContaining({
        options: expect.arrayContaining([expect.objectContaining({ label: 'value' })]),
      })
    );
  });
});
