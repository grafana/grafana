import { newLetterRandomizer } from './randomizer';

describe('Randomizer', () => {
  it('should randomize letters', () => {
    const rand = newLetterRandomizer();
    const a = rand('Hello-World');
    const b = rand('Hello-World');
    expect(a).toEqual(b);
    expect(a.indexOf('-')).toBe(5);
    // expect(a).toEqual('x');
  });

  it('should keep numbers', () => {
    const rand = newLetterRandomizer();
    const a = rand('123-Abc');
    const b = rand('123-Abc');
    expect(a).toEqual(b);
    expect(a.startsWith('123-')).toBeTruthy();
  });
});
