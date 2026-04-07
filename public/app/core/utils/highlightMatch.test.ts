import { highlightMatch } from './highlightMatch';

describe('highlightMatch', () => {
  it('wraps matching text in mark tags', () => {
    expect(highlightMatch('Hello world', 'world')).toBe('Hello <mark>world</mark>');
  });

  it('is case-insensitive', () => {
    expect(highlightMatch('Hello World', 'world')).toBe('Hello <mark>World</mark>');
  });

  it('returns original text when query is empty', () => {
    expect(highlightMatch('Hello world', '')).toBe('Hello world');
  });

  it('returns original text when query is whitespace only', () => {
    expect(highlightMatch('Hello world', '   ')).toBe('Hello world');
  });

  it('returns original text when no match is found', () => {
    expect(highlightMatch('Hello world', 'xyz')).toBe('Hello world');
  });

  it('matches only the first occurrence', () => {
    expect(highlightMatch('foo foo', 'foo')).toBe('<mark>foo</mark> foo');
  });
});
