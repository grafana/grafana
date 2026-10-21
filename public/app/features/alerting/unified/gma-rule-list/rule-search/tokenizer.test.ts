import { tokenize } from './tokenizer';
import { type RawToken } from './tokens';

/** Strips source spans; spans are tested separately below. */
function withoutSpans(tokens: RawToken[]) {
  return tokens.map(({ start, end, ...rest }) => rest);
}

describe('tokenize', () => {
  it.each([
    {
      name: 'free text and key:value tokens',
      input: 'cpu namespace:folder-1 high',
      expected: [
        { key: null, value: 'cpu', quoted: false, closed: true },
        { key: 'namespace', value: 'folder-1', quoted: false, closed: true },
        { key: null, value: 'high', quoted: false, closed: true },
      ],
    },
    {
      name: 'a quoted value as a single token',
      input: 'namespace:"My Folder"',
      expected: [{ key: 'namespace', value: 'My Folder', quoted: true, closed: true }],
    },
    {
      name: 'quoted free text as a single token',
      input: '"cpu high"',
      expected: [{ key: null, value: 'cpu high', quoted: true, closed: true }],
    },
    {
      name: 'an unterminated quote as not closed, without dropping it',
      input: 'namespace:"My Fol',
      expected: [{ key: 'namespace', value: 'My Fol', quoted: true, closed: false }],
    },
    {
      name: 'an empty value after a trailing colon as a draft token',
      input: 'label:',
      expected: [{ key: 'label', value: '', quoted: false, closed: true }],
    },
    {
      name: 'a colon with no valid key as part of a free-text word',
      input: '1:2:3',
      expected: [{ key: null, value: '1:2:3', quoted: false, closed: true }],
    },
    {
      name: 'a key starting with a digit as free text',
      input: '4chan:test',
      expected: [{ key: null, value: '4chan:test', quoted: false, closed: true }],
    },
  ])('reads $name', ({ input, expected }) => {
    expect(withoutSpans(tokenize(input))).toEqual(expected);
  });

  it('reports accurate source spans for each token', () => {
    expect(tokenize('cpu namespace:folder-1')).toEqual([
      { key: null, value: 'cpu', quoted: false, closed: true, start: 0, end: 3 },
      { key: 'namespace', value: 'folder-1', quoted: false, closed: true, start: 4, end: 22 },
    ]);
  });
});
