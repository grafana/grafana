import { CompletionContext } from '@codemirror/autocomplete';
import { sql as sqlLanguage } from '@codemirror/lang-sql';
import { EditorState } from '@codemirror/state';

import { getSqlCompletionSource, type SqlCompletionProvider } from './utils';

const getCompletionResult = (completionProvider: SqlCompletionProvider, sql: string, pos = sql.length) => {
  const completionSource = getSqlCompletionSource(completionProvider);
  const context = new CompletionContext(EditorState.create({ doc: sql, extensions: [sqlLanguage()] }), pos, true);

  return completionSource(context);
};

describe('SQL editor completion utils', () => {
  it('suggests tables in FROM and comma-separated FROM list positions', async () => {
    const completionProvider = {
      tables: () => [
        { label: 'A', insertText: 'A' },
        { label: 'B', insertText: 'B' },
      ],
    };

    await expect(getCompletionResult(completionProvider, 'SELECT * FROM ')).resolves.toEqual(
      expect.objectContaining({
        options: expect.arrayContaining([
          expect.objectContaining({ label: 'A' }),
          expect.objectContaining({ label: 'B' }),
        ]),
      })
    );

    await expect(getCompletionResult(completionProvider, 'SELECT * FROM A, ')).resolves.toEqual(
      expect.objectContaining({
        options: expect.arrayContaining([expect.objectContaining({ label: 'B' })]),
      })
    );
  });

  it('does not suggest tables after a comma outside the FROM/JOIN section', async () => {
    const result = await getCompletionResult(
      {
        tables: () => [{ label: 'A', insertText: 'A' }],
      },
      'SELECT * FROM A WHERE value, '
    );

    expect(result?.options).not.toEqual(expect.arrayContaining([expect.objectContaining({ label: 'A' })]));
  });

  it('suggests clauses after a table ref', async () => {
    const completionProvider = {
      clauses: () => [{ label: 'NEXT_CLAUSE' }],
    };

    await expect(getCompletionResult(completionProvider, 'SELECT * FROM A ')).resolves.toEqual(
      expect.objectContaining({
        options: expect.arrayContaining([expect.objectContaining({ label: 'NEXT_CLAUSE' })]),
      })
    );

    await expect(getCompletionResult(completionProvider, 'SELECT * FROM ')).resolves.toEqual(
      expect.not.objectContaining({
        options: expect.arrayContaining([expect.objectContaining({ label: 'NEXT_CLAUSE' })]),
      })
    );

    await expect(getCompletionResult(completionProvider, 'SELECT * FROM A WHERE ')).resolves.toEqual(
      expect.not.objectContaining({
        options: expect.arrayContaining([expect.objectContaining({ label: 'NEXT_CLAUSE' })]),
      })
    );
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

  it('prioritizes generic SQL keywords over matching function names', async () => {
    const result = await getCompletionResult(
      {
        functions: () => [{ label: 'from_unixtime', kind: 'function' }],
      },
      'SELECT A.__metric_name__\nfrom'
    );
    const fromKeyword = result?.options.find((option) => option.label === 'FROM');
    const fromFunction = result?.options.find((option) => option.label === 'from_unixtime');

    expect(fromKeyword).toEqual(
      expect.objectContaining({
        boost: expect.any(Number),
        section: { name: 'Keywords', rank: 2 },
        type: 'keyword',
      })
    );
    expect(fromFunction).toEqual(
      expect.objectContaining({
        section: { name: 'Functions', rank: 3 },
        type: 'function',
      })
    );
    expect(fromKeyword?.boost ?? 0).toBeGreaterThan(fromFunction?.boost ?? 0);
  });
});
