import { createPalette } from './createPalette';

describe('createColors', () => {
  it('Should enrich colors', () => {
    const palette = createPalette({});
    expect(palette.primary.name).toBe('primary');
  });

  it('Should allow overrides', () => {
    const palette = createPalette({
      primary: {
        main: '#FF0000',
      },
    });
    expect(palette.primary.main).toBe('#FF0000');
  });
});
