import { createTheme } from '../themes';

import { getColorForTheme } from './namedColorsPalette';

describe('colors', () => {
  const theme = createTheme();

  describe('getColorFromHexRgbOrName', () => {
    it('returns black for unknown color', () => {
      expect(getColorForTheme('aruba-sunshine', theme.v1)).toBe('aruba-sunshine');
    });

    it('returns dark hex variant for known color if theme not specified', () => {
      expect(getColorForTheme('semi-dark-blue', theme.v1)).toBe('#3274D9');
    });
  });
});
