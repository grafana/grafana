import { needsDynamicPalette } from './needsDynamicPalette';

describe('needsDynamicPalette', () => {
  it('returns false when color mode is not set', () => {
    expect(needsDynamicPalette(undefined)).toBe(false);
  });

  it('returns false for built-in color modes', () => {
    expect(needsDynamicPalette('thresholds')).toBe(false);
    expect(needsDynamicPalette('palette-classic')).toBe(false);
  });

  it('returns true for unknown custom color modes', () => {
    expect(needsDynamicPalette(`sunset-${Date.now()}`)).toBe(true);
  });
});
