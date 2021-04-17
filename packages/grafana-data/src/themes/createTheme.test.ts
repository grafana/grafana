import { createTheme } from './createTheme';

describe('createTheme', () => {
  it('create custom theme', () => {
    const custom = createTheme({
      palette: {
        mode: 'dark',
        primary: {
          main: 'rgb(240,0,0)',
        },
        background: {
          canvas: '#123',
        },
      },
    });

    expect(custom.palette.primary.main).toBe('rgb(240,0,0)');
    expect(custom.palette.primary.shade).toBe('rgb(242, 38, 38)');
    expect(custom.palette.background.canvas).toBe('#123');
  });

  it('create default theme', () => {
    const theme = createTheme();
    expect(theme.palette.mode).toBe('dark');
  });
});
