import { getColorName, getColorDefinition, ColorsPalete, buildColorDefinition } from './colorsPalette';

describe('colors', () => {
  const FakeBlue = buildColorDefinition('blue', 'blue', ['#0000ff', '#00000ee']);

  beforeAll(() => {
    ColorsPalete.set('blue', [FakeBlue])
  });

  describe('getColorDefinition', () => {
    it('returns undefined for unknown hex', () => {
      expect(getColorDefinition('#ff0000')).toBeUndefined();
    });

    it('returns definition for known hex', () => {
      expect(getColorDefinition(FakeBlue.variants.light)).toEqual(FakeBlue);
      expect(getColorDefinition(FakeBlue.variants.dark)).toEqual(FakeBlue);
    });
  });

  describe('getColorName', () => {
    it('returns undefined for unknown hex', () => {
      expect(getColorName('#ff0000')).toBeUndefined();
    });

    it('returns name for known hex', () => {
      expect(getColorName(FakeBlue.variants.light)).toEqual(FakeBlue.name);
      expect(getColorName(FakeBlue.variants.dark)).toEqual(FakeBlue.name);
    });
  });
});
