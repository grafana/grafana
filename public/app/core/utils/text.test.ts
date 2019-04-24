import { findMatchesInText, parseFlags } from './text';

describe('findMatchesInText()', () => {
  it('gets no matches for when search and or line are empty', () => {
    expect(findMatchesInText('', '')).toEqual([]);
    expect(findMatchesInText('foo', '')).toEqual([]);
    expect(findMatchesInText('', 'foo')).toEqual([]);
  });

  it('gets no matches for unmatched search string', () => {
    expect(findMatchesInText('foo', 'bar')).toEqual([]);
  });

  it('gets matches for matched search string', () => {
    expect(findMatchesInText('foo', 'foo')).toEqual([{ length: 3, start: 0, text: 'foo', end: 3 }]);
    expect(findMatchesInText(' foo ', 'foo')).toEqual([{ length: 3, start: 1, text: 'foo', end: 4 }]);
  });

  test('should find all matches for a complete regex', () => {
    expect(findMatchesInText(' foo foo bar ', 'foo|bar')).toEqual([
      { length: 3, start: 1, text: 'foo', end: 4 },
      { length: 3, start: 5, text: 'foo', end: 8 },
      { length: 3, start: 9, text: 'bar', end: 12 },
    ]);
  });

  test('not fail on incomplete regex', () => {
    expect(findMatchesInText(' foo foo bar ', 'foo|')).toEqual([
      { length: 3, start: 1, text: 'foo', end: 4 },
      { length: 3, start: 5, text: 'foo', end: 8 },
    ]);
    expect(findMatchesInText('foo foo bar', '(')).toEqual([]);
    expect(findMatchesInText('foo foo bar', '(foo|')).toEqual([]);
  });

  test('should parse and use flags', () => {
    expect(findMatchesInText(' foo FOO bar ', '(?i)foo')).toEqual([
      { length: 3, start: 1, text: 'foo', end: 4 },
      { length: 3, start: 5, text: 'FOO', end: 8 },
    ]);
    expect(findMatchesInText(' foo FOO bar ', '(?i)(?-i)foo')).toEqual([{ length: 3, start: 1, text: 'foo', end: 4 }]);
    expect(findMatchesInText('FOO\nfoobar\nbar', '(?ims)^foo.')).toEqual([
      { length: 4, start: 0, text: 'FOO\n', end: 4 },
      { length: 4, start: 4, text: 'foob', end: 8 },
    ]);
    expect(findMatchesInText('FOO\nfoobar\nbar', '(?ims)(?-smi)^foo.')).toEqual([]);
  });
});

describe('parseFlags()', () => {
  it('when no flags or text', () => {
    expect(parseFlags('')).toEqual({ cleaned: '', flags: 'g' });
    expect(parseFlags('(?is)')).toEqual({ cleaned: '', flags: 'gis' });
    expect(parseFlags('foo')).toEqual({ cleaned: 'foo', flags: 'g' });
  });

  it('when flags present', () => {
    expect(parseFlags('(?i)foo')).toEqual({ cleaned: 'foo', flags: 'gi' });
    expect(parseFlags('(?ims)foo')).toEqual({ cleaned: 'foo', flags: 'gims' });
  });

  it('when flags cancel each other', () => {
    expect(parseFlags('(?i)(?-i)foo')).toEqual({ cleaned: 'foo', flags: 'g' });
    expect(parseFlags('(?i-i)foo')).toEqual({ cleaned: 'foo', flags: 'g' });
    expect(parseFlags('(?is)(?-ims)foo')).toEqual({ cleaned: 'foo', flags: 'g' });
    expect(parseFlags('(?i)(?-i)(?i)foo')).toEqual({ cleaned: 'foo', flags: 'gi' });
  });
});
