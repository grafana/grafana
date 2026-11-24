import { createColors } from './createColors';
import { palette as refreshPalette } from './palette_new';

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

  it('Should provide a violet to orange button gradient from the visual refresh palette', () => {
    expect(createColors({ mode: 'dark' }).gradients.button).toBe(
      `linear-gradient(90deg, ${refreshPalette.violet400}, ${refreshPalette.orange400})`
    );
    expect(createColors({ mode: 'light' }).gradients.button).toBe(
      `linear-gradient(90deg, ${refreshPalette.violet600}, ${refreshPalette.orange600})`
    );
  });

  it('Should keep the default button gradient when a theme only overrides the brand gradients', () => {
    const colors = createColors({ gradients: { brandHorizontal: 'linear-gradient(90deg, red, blue)' } });
    expect(colors.gradients.brandHorizontal).toBe('linear-gradient(90deg, red, blue)');
    expect(colors.gradients.button).toBe(
      `linear-gradient(90deg, ${refreshPalette.violet400}, ${refreshPalette.orange400})`
    );
  });
});
