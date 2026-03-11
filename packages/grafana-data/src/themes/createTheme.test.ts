import { createTheme } from './createTheme';
import { getThemeById, getBuiltInThemes } from './registry';

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
});

describe('theme registry', () => {
  it('should build brightpink theme without errors', () => {
    const theme = getThemeById('brightpink');
    expect(theme).toBeDefined();
    expect(theme.name).toBe('Bright pink');
    expect(theme.colors.mode).toBe('light');
    expect(theme.colors.primary.main).toBe('#FF1493');
    expect(theme.colors.background.canvas).toBe('#FFF0F5');
  });

  it('should include brightpink in available themes when allowed', () => {
    const themes = getBuiltInThemes(['brightpink']);
    const brightpinkTheme = themes.find((t) => t.id === 'brightpink');
    expect(brightpinkTheme).toBeDefined();
    expect(brightpinkTheme?.name).toBe('Bright pink');
    expect(brightpinkTheme?.isExtra).toBe(true);
  });

  it('should not include brightpink when not in allowed list', () => {
    const themes = getBuiltInThemes([]);
    const brightpinkTheme = themes.find((t) => t.id === 'brightpink');
    expect(brightpinkTheme).toBeUndefined();
  });

  it('should always include built-in themes', () => {
    const themes = getBuiltInThemes([]);
    const builtInIds = themes.map((t) => t.id);
    expect(builtInIds).toContain('dark');
    expect(builtInIds).toContain('light');
    expect(builtInIds).toContain('system');
  });
});
