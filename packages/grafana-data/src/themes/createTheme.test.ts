import { readdirSync } from 'fs';
import { join } from 'path';

import { getContrastRatio } from './colorManipulator';
import { createTheme } from './createTheme';
import { getBuiltInThemes, getThemeById } from './registry';

// Every registered theme: the built-in ones and every theme definition, whether or not it is offered in the picker.
const allThemeIds = getBuiltInThemes(
  readdirSync(join(__dirname, 'themeDefinitions')).map((file) => file.replace(/\.json$/, ''))
)
  .map((theme) => theme.id)
  .filter((id) => id !== 'system');

const severities = ['error', 'warning', 'info', 'success'] as const;
const themeColors = ['primary', 'secondary', 'tertiary', 'accent'] as const;

// Neutral banner defaults that are below the contrast minimums in a theme's own palette: its theme color's text and
// emphasis text don't contrast enough with its subtle background. The themes that ship need their own tokens.
const knownNeutralBannerContrastGaps = ['aubergine', 'desertbloom', 'mars', 'synthwave', 'zen'];

describe('createTheme', () => {
  it('create custom theme', () => {
    const custom = createTheme({
      colors: {
        mode: 'dark',
        primary: {
          main: 'rgb(240,0,0)',
        },
        background: {
          canvas: '#123',
        },
      },
    });

    expect(custom.colors.primary.main).toBe('rgb(240,0,0)');
    expect(custom.colors.primary.shade).toBe('rgb(242, 38, 38)');
    expect(custom.colors.background.canvas).toBe('#123');
  });

  it('create default theme', () => {
    const theme = createTheme();
    expect(theme.colors.mode).toBe('dark');
  });

  it('deep-merges component overrides on top of the defaults', () => {
    const theme = createTheme({
      components: {
        height: { sm: 99 },
      },
    });

    // overridden value is applied
    expect(theme.components.height.sm).toBe(99);
    // sibling defaults are preserved by the deep merge
    expect(theme.components.height.md).toBe(4);
    expect(theme.components.height.lg).toBe(6);
  });

  it('replaces tag colors wholesale rather than merging by index', () => {
    const theme = createTheme({
      components: {
        tag: {
          colors: [{ background: '#fff', text: '#000' }],
        },
      },
    });

    expect(theme.components.tag.colors).toEqual([{ background: '#fff', text: '#000' }]);
  });

  it.each(['visual_refresh_dark', 'visual_refresh_light'])(
    'meets code editor contrast requirements for %s',
    (themeId) => {
      const theme = getThemeById(themeId);

      for (const background of [theme.components.input.background, theme.colors.background.secondary]) {
        for (const color of Object.values(theme.components.codeEditor)) {
          expect(getContrastRatio(color, background)).toBeGreaterThanOrEqual(4.5);
        }
      }
    }
  );

  it("defaults the prominent banner tokens to each severity's main, shade, contrast text and subtle border", () => {
    const theme = createTheme();

    for (const severity of severities) {
      expect(theme.components.banner.prominent[severity]).toEqual({
        background: theme.colors[severity].main,
        iconBoxBackground: theme.colors[severity].shade,
        text: theme.colors[severity].contrastText,
        border: theme.colors[severity].subtleBorder,
      });
    }
  });

  it("defaults the neutral banner tokens to each theme color's subtle colors", () => {
    const theme = createTheme();

    for (const themeColor of themeColors) {
      expect(theme.components.banner.neutral[themeColor]).toEqual({
        background: theme.colors[themeColor].subtleBackground,
        border: theme.colors[themeColor].subtleBorder,
        icon: theme.colors[themeColor].text,
        text: theme.colors[themeColor].textEmphasis,
      });
    }
  });

  // A prominent banner's text and icon use the text token. Text needs 4.5:1 on the background, and the icon needs 3:1
  // on its icon box.
  it.each(['visual_refresh_dark', 'visual_refresh_light'])(
    'provides accessible prominent banner colors for %s',
    (themeId) => {
      const theme = getThemeById(themeId);

      for (const { background, iconBoxBackground, text } of Object.values(theme.components.banner.prominent)) {
        expect(getContrastRatio(text, background)).toBeGreaterThanOrEqual(4.5);
        expect(getContrastRatio(text, iconBoxBackground)).toBeGreaterThanOrEqual(3);
      }
    }
  );

  it.each(['visual_refresh_dark', 'visual_refresh_light'])(
    'uses black or white prominent banner text for %s',
    (themeId) => {
      const theme = getThemeById(themeId);

      for (const { text } of Object.values(theme.components.banner.prominent)) {
        expect(text).toBe(theme.isLight ? '#000000' : '#ffffff');
      }
    }
  );

  // With the visual refresh flag on, Grafana shows the icon tile in every theme, including the ones that keep the
  // default tokens. The icon needs 3:1 on it.
  it.each(allThemeIds)('provides a prominent banner icon with 3:1 contrast on its icon box for %s', (themeId) => {
    const theme = getThemeById(themeId);

    for (const { iconBoxBackground, text } of Object.values(theme.components.banner.prominent)) {
      expect(getContrastRatio(text, iconBoxBackground)).toBeGreaterThanOrEqual(3);
    }
  });

  // With the visual refresh flag on, a neutral banner uses these tokens in every theme. Its text needs 4.5:1 and its
  // icon 3:1 on the background, which is translucent, so both are measured over the theme's primary background.
  it.each(allThemeIds.filter((id) => !knownNeutralBannerContrastGaps.includes(id)))(
    'provides accessible neutral banner colors for %s',
    (themeId) => {
      const theme = getThemeById(themeId);
      const canvas = theme.colors.background.primary;

      for (const { background, icon, text } of Object.values(theme.components.banner.neutral)) {
        expect(getContrastRatio(text, background, canvas)).toBeGreaterThanOrEqual(4.5);
        expect(getContrastRatio(icon, background, canvas)).toBeGreaterThanOrEqual(3);
      }
    }
  );

  // Fails once a theme in the list is fixed, so that the list only names real gaps.
  it.each(knownNeutralBannerContrastGaps)('still has a known neutral banner contrast gap in %s', (themeId) => {
    const theme = getThemeById(themeId);
    const canvas = theme.colors.background.primary;
    const hasGap = Object.values(theme.components.banner.neutral).some(
      ({ background, icon, text }) =>
        getContrastRatio(text, background, canvas) < 4.5 || getContrastRatio(icon, background, canvas) < 3
    );

    expect(hasGap).toBe(true);
  });

  it('checks banner contrast in more than the built-in and refresh themes', () => {
    expect(allThemeIds).toEqual(expect.arrayContaining(['dark', 'light', 'deut_prot_dark', 'tritanopia_light']));
  });

  it.each(['visual_refresh_dark', 'visual_refresh_light'])('provides accessible tag colors for %s', (themeId) => {
    const theme = getThemeById(themeId);

    for (const { background, text } of theme.components.tag.colors) {
      expect(getContrastRatio(text, background)).toBeGreaterThanOrEqual(4.5);
    }
  });
});
