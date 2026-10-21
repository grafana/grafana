import { type RawToken, tokenize } from './tokenizer';

/** Strips source spans; spans are tested separately below. */
function withoutSpans(tokens: RawToken[]) {
  return tokens.map(({ start, end, ...rest }) => rest);
}

describe('tokenize', () => {
  it.each([
    {
      name: 'free text and key:value tokens',
      input: 'cpu folder:folder-1 high',
      expected: [
        { key: null, value: 'cpu', closed: true },
        { key: 'folder', value: 'folder-1', closed: true },
        { key: null, value: 'high', closed: true },
      ],
    },
    {
      name: 'a quoted value as a single token',
      input: 'folder:"My Folder"',
      expected: [{ key: 'folder', value: 'My Folder', closed: true }],
    },
    {
      name: 'quoted free text as a single token',
      input: '"cpu high"',
      expected: [{ key: null, value: 'cpu high', closed: true }],
    },
    {
      name: 'an unterminated quote as not closed, without dropping it',
      input: 'folder:"My Fol',
      expected: [{ key: 'folder', value: 'My Fol', closed: false }],
    },
    {
      name: 'an empty value after a trailing colon as a draft token',
      input: 'label:',
      expected: [{ key: 'label', value: '', closed: true }],
    },
    {
      name: 'a colon with no valid key as part of a free-text word',
      input: '1:2:3',
      expected: [{ key: null, value: '1:2:3', closed: true }],
    },
    {
      name: 'a key starting with a digit as free text',
      input: '4chan:test',
      expected: [{ key: null, value: '4chan:test', closed: true }],
    },
  ])('reads $name', ({ input, expected }) => {
    expect(withoutSpans(tokenize(input))).toEqual(expected);
  });

  it('reports accurate source spans for each token', () => {
    expect(tokenize('cpu folder:folder-1')).toEqual([
      { key: null, value: 'cpu', closed: true, start: 0, end: 3 },
      { key: 'folder', value: 'folder-1', closed: true, start: 4, end: 19 },
    ]);
  });
});
