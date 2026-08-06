import { getContrastRatio } from './colorManipulator';
import { createTheme } from './createTheme';
import { palette } from './palette_new';
import { getThemeById } from './registry';

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

  it('deep-merges code editor semantic color overrides', () => {
    const theme = createTheme({
      components: {
        codeEditor: {
          keyword: '#fff',
        },
      },
    });

    expect(theme.components.codeEditor.keyword).toBe('#fff');
    expect(theme.components.codeEditor.string).toBe(theme.colors.success.text);
  });

  it.each([
    [
      'visual_refresh_dark',
      {
        keyword: palette.blue300,
        controlKeyword: palette.violet300,
        variable: palette.sky300,
        type: palette.teal300,
        function: palette.amber300,
        number: palette.peach300,
        string: palette.sage300,
        operator: palette.ink250,
        regexp: palette.rose300,
        comment: palette.ink350,
        heading: palette.blue300,
        link: palette.blue300,
        invalid: palette.red300,
      },
    ],
    [
      'visual_refresh_light',
      {
        keyword: palette.blue700,
        controlKeyword: palette.violet700,
        variable: palette.sky700,
        type: palette.teal700,
        function: palette.amber700,
        number: palette.peach700,
        string: palette.sage700,
        operator: palette.neutral650,
        regexp: palette.rose700,
        comment: palette.neutral600,
        heading: palette.blue700,
        link: palette.blue700,
        invalid: palette.red700,
      },
    ],
  ])('resolves code editor palette references for %s', (themeId, expected) => {
    const theme = getThemeById(themeId);

    expect(theme.components.codeEditor).toEqual(expected);

    for (const background of [theme.components.input.background, theme.colors.background.secondary]) {
      for (const color of Object.values(theme.components.codeEditor)) {
        expect(getContrastRatio(color, background)).toBeGreaterThanOrEqual(4.5);
      }
    }
  });
});
