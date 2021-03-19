import fuzzySearch from './fuzzy';
import { CompletionItem } from '../types';

function createItems(...labels: string[]): CompletionItem[] {
  return labels.map((label) => ({ label }));
}

describe('Fuzzy search', () => {
  it('includes only matching elements', () => {
    const items = createItems('foo_bar', 'foo', 'bar');
    const result = fuzzySearch(items, 'foo');

    expect(result.length).toBe(2);
    expect(result).toEqual([expect.objectContaining({ label: 'foo_bar' }), expect.objectContaining({ label: 'foo' })]);
  });

  it('is case insensitive', () => {
    const items = createItems('foo_bar', 'FOO', 'bar');
    const result = fuzzySearch(items, 'Foo');

    expect(result.length).toBe(2);
    expect(result).toEqual([expect.objectContaining({ label: 'foo_bar' }), expect.objectContaining({ label: 'FOO' })]);
  });

  it('finds highlight ranges with single letters', () => {
    const items = createItems('foo', 'xyzzy', 'bar', 'foo_xyzzy_bar');
    const result = fuzzySearch(items, 'fxb');

    expect(result.length).toBe(1);

    // word:  foo_xyzzy_bar
    // match: +---+-----+-- => 0, 4, 10
    // dist:  0111011111000 => total gaps: 8
    expect(result).toEqual([
      expect.objectContaining({
        label: 'foo_xyzzy_bar',
        matching: {
          ranges: [
            { start: 0, end: 0 },
            { start: 4, end: 4 },
            { start: 10, end: 10 },
          ],
          score: 8,
        },
      }),
    ]);
  });

  it('finds highlight ranges for multiple outter words', () => {
    const items = createItems('foo', 'xyzzy', 'bar', 'foo_xyzzy_bar');
    const result = fuzzySearch(items, 'FOOBAR');

    expect(result.length).toBe(1);

    // word:  foo_xyzzy_bar
    // match: +++-------+++ => 0, 10
    // dist:  0001111111000 => total gaps: 7
    expect(result).toEqual([
      expect.objectContaining({
        label: 'foo_xyzzy_bar',
        matching: {
          ranges: [
            { start: 0, end: 2 },
            { start: 10, end: 12 },
          ],
          score: 7,
        },
      }),
    ]);
  });

  it('finds highlight ranges for multiple inner words', () => {
    const items = createItems('foo', 'xyzzy', 'bar', 'foo_xyzzy_bar');
    const result = fuzzySearch(items, 'OOZZYBA');

    expect(result.length).toBe(1);

    // word:  foo_xyzzy_bar
    // match: -**---***-++- => range indices: 1, 6, 10
    // dist:  0001110001000 => total gaps: 4
    expect(result).toEqual([
      expect.objectContaining({
        label: 'foo_xyzzy_bar',
        matching: {
          ranges: [
            { start: 1, end: 2 },
            { start: 6, end: 8 },
            { start: 10, end: 11 },
          ],
          score: 4,
        },
      }),
    ]);
  });

  it('scores exact matches higher if available', () => {
    const items = createItems('foo_bar_xyzzy', 'b_a_r');
    const result = fuzzySearch(items, 'bar');

    expect(result.length).toBe(2);

    expect(result).toEqual([
      expect.objectContaining({
        label: 'foo_bar_xyzzy',
        matching: {
          ranges: [{ start: 4, end: 7 }],
          score: 0,
        },
      }),
      expect.objectContaining({
        label: 'b_a_r',
        matching: {
          ranges: [
            { start: 0, end: 0 },
            { start: 2, end: 2 },
            { start: 4, end: 4 },
          ],
          score: 2,
        },
      }),
    ]);
  });
});
