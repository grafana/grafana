import { stringToHighlighted } from './ScopesTreeItem';

describe('stringToHighlighted', () => {
  it('should highlight the substring', () => {
    expect(stringToHighlighted('hello world', 'world')).toBe('hello <mark>world</mark>');
  });
  it('should highlight the substring with wildcard', () => {
    expect(stringToHighlighted('hello world', 'wor*')).toBe('hello <mark>wor</mark>ld');
  });
  it('should highlight the substring with multiple wildcards', () => {
    expect(stringToHighlighted('hello world', 'wor*ld*')).toBe('hello <mark>wor</mark><mark>ld</mark>');
  });

  it('should highlight the substring with multiple wildcards', () => {
    expect(stringToHighlighted('hello world', 'he*ld')).toBe('<mark>he</mark>llo wor<mark>ld</mark>');
  });
});
