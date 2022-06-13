import { createTheme } from '../themes';

describe('colors', () => {
  const theme = createTheme();

  describe('getColorFromHexRgbOrName', () => {
    it('returns black for unknown color', () => {
      expect(theme.v1.visualization.getColorByName('aruba-sunshine')).toBe('aruba-sunshine');
    });

    it('returns dark hex variant for known color if theme not specified', () => {
      expect(theme.v1.visualization.getColorByName('semi-dark-blue')).toBe('#3274D9');
    });
  });
});
