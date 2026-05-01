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

  it('resolves columns for explicit aliases in qualified column completions', async () => {
    const columns = jest.fn().mockReturnValue([{ label: 'value', insertText: 'value' }]);
    const result = await getCompletionResult(
      { tables: () => [{ label: 'A', insertText: 'A' }], columns },
      'SELECT a. FROM A AS a',
      'SELECT a.'.length
    );

    expect(columns).toHaveBeenCalledWith({ table: 'A' });
    expect(result).toEqual(
      expect.objectContaining({
        options: expect.arrayContaining([expect.objectContaining({ label: 'value' })]),
      })
    );
  });

  it('resolves columns for implicit join aliases in qualified column completions', async () => {
    const columns = jest.fn().mockReturnValue([{ label: 'count', insertText: 'count' }]);
    const result = await getCompletionResult(
      {
        tables: () => [
          { label: 'A', insertText: 'A' },
          { label: 'B', insertText: 'B' },
        ],
        columns,
      },
      'SELECT b. FROM A AS a JOIN B b ON a.time = b.time',
      'SELECT b.'.length
    );

    expect(columns).toHaveBeenCalledWith({ table: 'B' });
    expect(result).toEqual(
      expect.objectContaining({
        options: expect.arrayContaining([expect.objectContaining({ label: 'count' })]),
      })
    );
  });

  it('does not treat join modifiers as aliases in qualified column completions', async () => {
    const columns = jest.fn().mockReturnValue([{ label: 'value', insertText: 'value' }]);
    const result = await getCompletionResult(
      {
        tables: () => [
          { label: 'A', insertText: 'A' },
          { label: 'B', insertText: 'B' },
        ],
        columns,
      },
      'SELECT left. FROM A LEFT JOIN B b ON A.time = B.time',
      'SELECT left.'.length
    );

    expect(columns).not.toHaveBeenCalled();
    expect(result).toBeNull();
  });

  it('resolves columns for from tables in parallel', async () => {
    let resolveA: (items: Array<{ label: string }>) => void = () => {};
    const tableAColumns = new Promise<Array<{ label: string }>>((resolve) => {
      resolveA = resolve;
    });
    const columns = jest.fn(({ table }) => {
      if (table === 'A') {
        return tableAColumns;
      }

      return [{ label: 'bValue' }];
    });

    const resultPromise = getCompletionResult(
      {
        columns,
        functions: () => [],
      },
      'SELECT value FROM A JOIN B ON A.time = B.time',
      'SELECT value'.length
    );

    await Promise.resolve();

    expect(columns).toHaveBeenCalledWith({ table: 'A' });
    expect(columns).toHaveBeenCalledWith({ table: 'B' });

    resolveA([{ label: 'aValue' }]);

    await expect(resultPromise).resolves.toEqual(
      expect.objectContaining({
        options: expect.arrayContaining([
          expect.objectContaining({ label: 'aValue' }),
          expect.objectContaining({ label: 'bValue' }),
        ]),
      })
    );
  });
});
