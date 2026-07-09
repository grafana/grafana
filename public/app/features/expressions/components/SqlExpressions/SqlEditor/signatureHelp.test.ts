import { sql as sqlLanguage } from '@codemirror/lang-sql';
import { EditorState } from '@codemirror/state';

import { getSqlSignatureHelpProvider, type SqlFunctionSignature } from './signatureHelp';

const SIGNATURES: SqlFunctionSignature[] = [
  {
    name: 'round',
    parameters: [{ label: 'value: number' }, { label: 'decimals: number' }],
    returnType: 'number',
    documentation: 'Rounds a number.',
  },
  {
    name: 'coalesce',
    parameters: [{ label: 'value: any' }, { label: '...values: any' }],
    returnType: 'any',
  },
  {
    name: 'pi',
    parameters: [],
    returnType: 'number',
  },
];

const getHelp = (doc: string, pos: number = doc.length) => {
  const provider = getSqlSignatureHelpProvider(SIGNATURES);
  const state = EditorState.create({ doc, extensions: [sqlLanguage()] });
  return provider(state, pos);
};

describe('getSqlSignatureHelpProvider', () => {
  it('returns the matching signature when the cursor is inside a known call', () => {
    expect(getHelp('SELECT round(')).toEqual({
      signatures: [
        {
          name: 'round',
          returnType: 'number',
          documentation: 'Rounds a number.',
          parameters: [{ label: 'value: number' }, { label: 'decimals: number' }],
        },
      ],
      activeSignature: 0,
      activeParameter: 0,
    });
  });

  it('advances the active parameter after a comma', () => {
    expect(getHelp('SELECT round(value, ')).toEqual(expect.objectContaining({ activeParameter: 1 }));
  });

  it('matches function names case-insensitively', () => {
    expect(getHelp('SELECT ROUND(')).toEqual(expect.objectContaining({ activeSignature: 0 }));
    expect(getHelp('SELECT ROUND(')?.signatures[0].name).toBe('round');
  });

  it('clamps the active parameter to the last declared parameter for variadic functions', () => {
    expect(getHelp('SELECT coalesce(a, b, c, ')).toEqual(expect.objectContaining({ activeParameter: 1 }));
  });

  it('returns null for unknown functions', () => {
    expect(getHelp('SELECT unknownFn(')).toBeNull();
  });

  it('returns null for grouping parentheses that follow a keyword', () => {
    expect(getHelp('SELECT (')).toBeNull();
  });

  it('returns null when the cursor is not inside a call', () => {
    expect(getHelp('SELECT 1')).toBeNull();
  });
});
