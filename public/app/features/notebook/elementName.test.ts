import { mintElementName } from './elementName';

describe('mintElementName', () => {
  it('appends six lowercase alphanumeric characters to the base', () => {
    for (let i = 0; i < 50; i++) {
      expect(mintElementName('heading', () => false)).toMatch(/^heading-[a-z0-9]{6}$/);
    }
  });

  it('retries until it finds a name that is not taken', () => {
    const suffixes = ['aaaaaa', 'bbbbbb'];
    const taken = new Set(['heading-aaaaaa']);

    const name = mintElementName(
      'heading',
      (candidate) => taken.has(candidate),
      () => suffixes.shift()!
    );

    expect(name).toBe('heading-bbbbbb');
  });
});
