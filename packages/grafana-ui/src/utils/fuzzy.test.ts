import { fuzzyMatch } from './fuzzy';

describe('Fuzzy search', () => {
  it('finds only matching elements', () => {
    expect(fuzzyMatch('foo', 'foo')).toEqual({
      distance: 0,
      ranges: [{ start: 0, end: 2 }],
      found: true,
    });

    expect(fuzzyMatch('foo_bar', 'foo')).toEqual({
      distance: 0,
      ranges: [{ start: 0, end: 2 }],
      found: true,
    });

    expect(fuzzyMatch('bar', 'foo')).toEqual({
      distance: Infinity,
      ranges: [],
      found: false,
    });
  });

  it('is case sensitive', () => {
    expect(fuzzyMatch('foo_bar', 'BAR')).toEqual({
      distance: Infinity,
      ranges: [],
      found: false,
    });
    expect(fuzzyMatch('Foo_Bar', 'bar')).toEqual({
      distance: Infinity,
      ranges: [],
      found: false,
    });
  });

  it('finds highlight ranges with single letters', () => {
    expect(fuzzyMatch('foo_xyzzy_bar', 'fxb')).toEqual({
      ranges: [
        { start: 0, end: 0 },
        { start: 4, end: 4 },
        { start: 10, end: 10 },
      ],
      distance: 8,
      found: true,
    });
  });

  it('finds highlight ranges for multiple outer words', () => {
    expect(fuzzyMatch('foo_xyzzy_bar', 'foobar')).toEqual({
      ranges: [
        { start: 0, end: 2 },
        { start: 10, end: 12 },
      ],
      distance: 7,
      found: true,
    });
  });

  it('finds highlight ranges for multiple inner words', () => {
    expect(fuzzyMatch('foo_xyzzy_bar', 'oozzyba')).toEqual({
      ranges: [
        { start: 1, end: 2 },
        { start: 6, end: 8 },
        { start: 10, end: 11 },
      ],
      distance: 4,
      found: true,
    });
  });

  it('promotes exact matches', () => {
    expect(fuzzyMatch('bbaarr_bar_bbaarr', 'bar')).toEqual({
      ranges: [{ start: 7, end: 9 }],
      distance: 0,
      found: true,
    });
  });

  it('ignores whitespace in needle', () => {
    expect(fuzzyMatch('bbaarr_bar_bbarr', 'bb bar')).toEqual({
      ranges: [
        { start: 0, end: 1 },
        { start: 7, end: 9 },
      ],
      distance: 5,
      found: true,
    });
  });
});
