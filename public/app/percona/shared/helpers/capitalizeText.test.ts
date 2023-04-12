import { capitalizeText } from './capitalizeText';

describe('capitalizeText', () => {
  it('should correctly capitalize a string', () => {
    expect(capitalizeText('foo')).toBe('Foo');
    expect(capitalizeText('Foo')).toBe('Foo');
    expect(capitalizeText('fOO')).toBe('Foo');
    expect(capitalizeText('fOo')).toBe('Foo');
    expect(capitalizeText('')).toBe('');
    expect(capitalizeText('f')).toBe('F');
    expect(capitalizeText('F')).toBe('F');
  });
});
