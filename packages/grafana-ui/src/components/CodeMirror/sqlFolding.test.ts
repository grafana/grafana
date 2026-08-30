import { foldable } from '@codemirror/language';
import { EditorState } from '@codemirror/state';

import { foldByIndentation } from './sqlFolding';

const getFoldableRange = (doc: string, lineNumber: number) => {
  const state = EditorState.create({ doc, extensions: [foldByIndentation] });
  const line = state.doc.line(lineNumber);
  return foldable(state, line.from, line.to);
};

describe('foldByIndentation', () => {
  it('folds indented lines under SQL clauses', () => {
    const doc = `SELECT
  one,
  two
FROM
  table_a
WHERE
  one > 0`;

    expect(getFoldableRange(doc, 1)).toEqual({ from: 6, to: 19 });
    expect(getFoldableRange(doc, 4)).toEqual({ from: 24, to: 34 });
    expect(getFoldableRange(doc, 6)).toEqual({ from: 40, to: 50 });
  });

  it('keeps nested indentation in the parent fold', () => {
    const doc = `WHERE
  one IN (
    SELECT one
    FROM table_a
  )
ORDER BY one`;

    expect(getFoldableRange(doc, 1)).toEqual({ from: 5, to: 52 });
    expect(getFoldableRange(doc, 2)).toEqual({ from: 16, to: 48 });
  });

  it('ignores blank lines when finding an indented block', () => {
    const doc = `FROM

  table_a

WHERE one > 0`;

    expect(getFoldableRange(doc, 1)).toEqual({ from: 4, to: 15 });
  });

  it('compares mixed tab and space indentation by column', () => {
    const doc = `FROM
\t table_a
  table_b
WHERE one > 0`;

    expect(getFoldableRange(doc, 1)).toEqual({ from: 4, to: 24 });
    expect(getFoldableRange(doc, 2)).toBeNull();
  });

  it('does not fold a line without indented content', () => {
    const doc = `SELECT one
FROM table_a
WHERE one > 0`;

    expect(getFoldableRange(doc, 2)).toBeNull();
  });
});
