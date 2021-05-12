import { getColorForTheme } from './namedColorsPalette';
import { createTheme } from '../themes';

describe('colors', () => {
  const theme = createTheme();

  describe('getColorFromHexRgbOrName', () => {
    it('returns black for unknown color', () => {
      expect(getColorForTheme('aruba-sunshine', theme.v1)).toBe('aruba-sunshine');
    });

    it('returns dark hex variant for known color if theme not specified', () => {
      expect(getColorForTheme('semi-dark-blue', theme.v1)).toBe('#5D8FEF');
    });

    // Why?
    /* it('returns hex for named color that is not a part of named colors palette', () => {
      expect(getColorForTheme('lime')).toBe('#00ff00');
    }); */
  });
});
