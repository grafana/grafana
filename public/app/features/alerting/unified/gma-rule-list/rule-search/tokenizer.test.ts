import { tokenize } from './tokenizer';
import { type RawToken } from './tokens';

/** Strips source spans so tests can focus on token content; span correctness is covered
 * separately below. */
function withoutSpans(tokens: RawToken[]) {
  return tokens.map(({ start, end, ...rest }) => rest);
}

describe('tokenize', () => {
  it('SEARCH-1: splits free text and key:value tokens', () => {
    expect(withoutSpans(tokenize('cpu namespace:folder-1 high'))).toEqual([
      { key: null, value: 'cpu', quoted: false, closed: true },
      { key: 'namespace', value: 'folder-1', quoted: false, closed: true },
      { key: null, value: 'high', quoted: false, closed: true },
    ]);
  });

  it('SEARCH-1: reads a quoted value as a single token', () => {
    expect(withoutSpans(tokenize('namespace:"My Folder"'))).toEqual([
      { key: 'namespace', value: 'My Folder', quoted: true, closed: true },
    ]);
  });

  it('SEARCH-1: reads quoted free text as a single token', () => {
    expect(withoutSpans(tokenize('"cpu high"'))).toEqual([
      { key: null, value: 'cpu high', quoted: true, closed: true },
    ]);
  });

  it('SEARCH-1: marks an unterminated quote as not closed, without dropping it', () => {
    expect(withoutSpans(tokenize('namespace:"My Fol'))).toEqual([
      { key: 'namespace', value: 'My Fol', quoted: true, closed: false },
    ]);
  });

  it('SEARCH-1: preserves an empty value after a trailing colon as a draft token', () => {
    expect(withoutSpans(tokenize('label:'))).toEqual([{ key: 'label', value: '', quoted: false, closed: true }]);
  });

  it('SEARCH-1: treats a colon with no valid key as part of a free-text word', () => {
    expect(withoutSpans(tokenize('1:2:3'))).toEqual([{ key: null, value: '1:2:3', quoted: false, closed: true }]);
  });

  it('SEARCH-1: does not treat a key starting with a digit as a filter token', () => {
    expect(withoutSpans(tokenize('4chan:test'))).toEqual([
      { key: null, value: '4chan:test', quoted: false, closed: true },
    ]);
  });

  it('SEARCH-1: reports accurate source spans for each token', () => {
    expect(tokenize('cpu namespace:folder-1')).toEqual([
      { key: null, value: 'cpu', quoted: false, closed: true, start: 0, end: 3 },
      { key: 'namespace', value: 'folder-1', quoted: false, closed: true, start: 4, end: 22 },
    ]);
  });
});
