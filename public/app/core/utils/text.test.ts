import { findMatchesInText } from './text';

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

  expect(findMatchesInText(' foo foo bar ', 'foo|bar')).toEqual([
    { length: 3, start: 1, text: 'foo', end: 4 },
    { length: 3, start: 5, text: 'foo', end: 8 },
    { length: 3, start: 9, text: 'bar', end: 12 },
  ]);
});
