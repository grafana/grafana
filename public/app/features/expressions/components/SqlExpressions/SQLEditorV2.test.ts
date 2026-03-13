import { Text } from '@codemirror/state';
import React from 'react';
import { act, render, waitFor } from 'test/test-utils';

import { getFromTables, isAfterFromOrJoin, isAtClauseStart, SQLEditorV2 } from './SQLEditorV2';

const originalGetClientRects = Range.prototype.getClientRects;

function emptyClientRects(): DOMRectList {
  const rects = [] as unknown as DOMRectList & DOMRect[];
  rects.item = (index: number) => rects[index] ?? null;
  return rects;
}

beforeAll(() => {
  if (!originalGetClientRects) {
    Object.defineProperty(Range.prototype, 'getClientRects', {
      configurable: true,
      value: emptyClientRects,
    });
  }
});

afterAll(() => {
  if (originalGetClientRects) {
    Object.defineProperty(Range.prototype, 'getClientRects', {
      configurable: true,
      value: originalGetClientRects,
    });
    return;
  }

  delete (Range.prototype as Range & { getClientRects?: () => DOMRectList }).getClientRects;
});

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

describe('isAtClauseStart', () => {
  function check(text: string, pos?: number) {
    const doc = Text.of(text.split('\n'));
    return isAtClauseStart(doc, pos ?? text.length);
  }

  it('returns true after FROM table list on same line', () => {
    expect(check('SELECT * FROM A, B ')).toBe(true);
  });

  it('returns true after single table in FROM', () => {
    expect(check('SELECT * FROM A ')).toBe(true);
  });

  it('returns true after multiline FROM table list', () => {
    expect(check('SELECT *\nFROM\n  A, B\n')).toBe(true);
  });

  it('returns true when starting to type a clause keyword', () => {
    expect(check('SELECT * FROM A, B GR')).toBe(true);
  });

  it('returns false in the middle of a FROM list (after comma)', () => {
    expect(check('SELECT * FROM A, ')).toBe(false);
  });

  it('returns false directly after FROM keyword', () => {
    expect(check('SELECT * FROM ')).toBe(false);
  });

  it('returns false in SELECT clause', () => {
    expect(check('SELECT ')).toBe(false);
  });
});

describe('SQLEditorV2 completion behavior', () => {
  it('accepts a completion with Enter and leaves the dropdown closed', async () => {
    const onChange = jest.fn();
    const language = {
      completionProvider: {
        getTables: jest.fn(async () => {
          await new Promise((resolve) => setTimeout(resolve, 10));
          return ['users'];
        }),
        getColumns: jest.fn(async () => []),
      },
    };

    const { container, user } = render(React.createElement(SQLEditorV2, { query: '', onChange, language }));
    const editor = container.querySelector('[contenteditable="true"]') as HTMLElement | null;

    expect(editor).not.toBeNull();

    await user.click(editor!);
    await user.type(editor!, 'SELECT * FROM u');

    await waitFor(() => {
      expect(container.querySelector('.cm-tooltip-autocomplete')).toBeInTheDocument();
    });

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 150));
    });

    await user.keyboard('{Enter}');

    await waitFor(() => {
      expect(onChange).toHaveBeenLastCalledWith('SELECT * FROM users', true);
    });

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 150));
    });

    expect(container.querySelector('.cm-tooltip-autocomplete')).not.toBeInTheDocument();
  });
});
