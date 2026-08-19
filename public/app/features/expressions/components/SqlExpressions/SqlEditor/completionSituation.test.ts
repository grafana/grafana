import { sql as sqlLanguage } from '@codemirror/lang-sql';
import { EditorState } from '@codemirror/state';

import { getEnclosingFunctionCall } from './completionSituation';

const enclosingCall = (doc: string, pos: number = doc.length) => {
  const state = EditorState.create({ doc, extensions: [sqlLanguage()] });
  return getEnclosingFunctionCall(state, pos);
};

describe('getEnclosingFunctionCall', () => {
  it('detects a function name right after the opening parenthesis', () => {
    expect(enclosingCall('SELECT round(')).toEqual({ name: 'round', activeParameter: 0 });
  });

  it('detects keyword-named functions such as count', () => {
    expect(enclosingCall('SELECT count(')).toEqual({ name: 'count', activeParameter: 0 });
  });

  it('advances the active parameter after each argument separator', () => {
    expect(enclosingCall('SELECT round(value, ')).toEqual({ name: 'round', activeParameter: 1 });
  });

  it('keeps the active parameter on the current argument before the comma', () => {
    const doc = 'SELECT round(value, 2)';
    expect(enclosingCall(doc, 'SELECT round(value'.length)).toEqual({ name: 'round', activeParameter: 0 });
  });

  it('returns the innermost call for nested function calls', () => {
    const doc = 'SELECT pow(mod(a, b), c)';
    expect(enclosingCall(doc, 'SELECT pow(mod(a, '.length)).toEqual({ name: 'mod', activeParameter: 1 });
  });

  it('does not count separators from nested calls in the outer active parameter', () => {
    const doc = 'SELECT pow(mod(a, b), ';
    expect(enclosingCall(doc)).toEqual({ name: 'pow', activeParameter: 1 });
  });

  it('preserves the function name casing from the document', () => {
    expect(enclosingCall('SELECT ROUND(')).toEqual({ name: 'ROUND', activeParameter: 0 });
  });

  it('returns null when the cursor is not inside a call', () => {
    expect(enclosingCall('SELECT value')).toBeNull();
  });

  it('returns null when the cursor is immediately after the closing parenthesis', () => {
    expect(enclosingCall('SELECT round(value, 2)')).toBeNull();
  });

  it('returns null once the cursor moves past the closing parenthesis', () => {
    const doc = 'SELECT round(value, 2) ';
    expect(enclosingCall(doc)).toBeNull();
  });

  it('falls back to the outer call when the cursor is just after a nested call', () => {
    const doc = 'SELECT pow(mod(a, b), c)';
    expect(enclosingCall(doc, 'SELECT pow(mod(a, b)'.length)).toEqual({ name: 'pow', activeParameter: 0 });
  });
});
