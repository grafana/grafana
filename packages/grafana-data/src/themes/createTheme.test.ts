import { createTheme } from './createTheme';

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
});
