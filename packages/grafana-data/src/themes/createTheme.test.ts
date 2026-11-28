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

  it("defaults the alert banner tokens to each severity's main and shade colors", () => {
    const theme = createTheme();

    for (const severity of ['error', 'warning', 'info', 'success'] as const) {
      expect(theme.components.alertBanner[severity]).toEqual({
        background: theme.colors[severity].main,
        iconBoxBackground: theme.colors[severity].shade,
        text: theme.colors[severity].contrastText,
        border: theme.colors[severity].subtleBorder,
      });
    }
  });

  // AlertBanner's text and icon use the text token. Text needs 4.5:1 on the banner's background, and the icon needs
  // 3:1 on its icon box.
  it.each(['visual_refresh_dark', 'visual_refresh_light'])(
    'provides accessible alert banner colors for %s',
    (themeId) => {
      const theme = getThemeById(themeId);

      for (const { background, iconBoxBackground, text } of Object.values(theme.components.alertBanner)) {
        expect(getContrastRatio(text, background)).toBeGreaterThanOrEqual(4.5);
        expect(getContrastRatio(text, iconBoxBackground)).toBeGreaterThanOrEqual(3);
      }
    }
  );

  // With the visual refresh flag on, Grafana shows AlertBanner's icon tile in every theme, including the ones that keep
  // the default tokens: the severity's shade behind its contrast text color. The icon needs 3:1 on it.
  it.each(allThemeIds)('provides an alert banner icon with 3:1 contrast on its icon box for %s', (themeId) => {
    const theme = getThemeById(themeId);

    for (const { iconBoxBackground, text } of Object.values(theme.components.alertBanner)) {
      expect(getContrastRatio(text, iconBoxBackground)).toBeGreaterThanOrEqual(3);
    }
  });

  it('checks the icon box contrast in more than the built-in and refresh themes', () => {
    expect(allThemeIds).toEqual(expect.arrayContaining(['dark', 'light', 'deut_prot_dark', 'tritanopia_light']));
  });

  it.each(['visual_refresh_dark', 'visual_refresh_light'])(
    'uses black or white alert banner text for %s',
    (themeId) => {
      const theme = getThemeById(themeId);

      for (const { text } of Object.values(theme.components.alertBanner)) {
        expect(text).toBe(theme.isLight ? '#000000' : '#ffffff');
      }
    }
  );

  it.each(['visual_refresh_dark', 'visual_refresh_light'])('provides accessible tag colors for %s', (themeId) => {
    const theme = getThemeById(themeId);

    for (const { background, text } of theme.components.tag.colors) {
      expect(getContrastRatio(text, background)).toBeGreaterThanOrEqual(4.5);
    }
  });
});
