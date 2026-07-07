import { createColors } from './createColors';

describe('createColors', () => {
  it('Should enrich colors', () => {
    const palette = createColors({});
    expect(palette.primary.name).toBe('primary');
  });

  it('Should allow overrides', () => {
    const palette = createColors({
      primary: {
        main: '#FF0000',
      },
    });
    expect(palette.primary.main).toBe('#FF0000');
  });

  it('Should use opaque border tokens', () => {
    const darkPalette = createColors({ mode: 'dark' });
    const lightPalette = createColors({ mode: 'light' });

    // border tokens should not have transparency (fixes semi-transparent modal borders)
    expect(darkPalette.border.weak).not.toContain('rgba');
    expect(darkPalette.border.medium).not.toContain('rgba');
    expect(darkPalette.border.strong).not.toContain('rgba');
    expect(lightPalette.border.weak).not.toContain('rgba');
    expect(lightPalette.border.medium).not.toContain('rgba');
    expect(lightPalette.border.strong).not.toContain('rgba');

    expect(darkPalette.border.weak).toBe('rgb(54, 57, 64)');
    expect(darkPalette.border.medium).toBe('rgb(68, 70, 78)');
    expect(darkPalette.border.strong).toBe('rgb(85, 87, 96)');
    expect(lightPalette.border.weak).toBe('rgb(229, 229, 230)');
    expect(lightPalette.border.medium).toBe('rgb(189, 191, 192)');
    expect(lightPalette.border.strong).toBe('rgb(167, 169, 171)');
  });
});
