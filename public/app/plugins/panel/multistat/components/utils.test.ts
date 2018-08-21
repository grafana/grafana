import { getFontSize } from './utils';

describe('getFontSize()', () => {
  it('calculate proper font size for given element and text', () => {
    expect(getFontSize('abcdefghij', 100)).toBe(10);
    expect(getFontSize('abcdefghi', 100)).toBe(11);
  });

  it('calculate proper font size for given element and text if height is limited', () => {
    expect(getFontSize('abcdefghij', 100, 10)).toBe(10);
  });
});
