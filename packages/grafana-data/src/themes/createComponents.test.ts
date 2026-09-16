import { ThemeComponentsInputSchema } from './createComponents';
import { createTheme } from './createTheme';
import { getThemeById } from './registry';

describe('table colors', () => {
  it.each([
    ['dark', '#2c2f35', '#22252b', '#34363a'],
    ['light', '#ececed', '#f4f5f5', '#e0e0e0'],
    ['visual_refresh_dark', '#202429', '#191d22', '#282d33'],
    ['visual_refresh_light', '#f0f0ef', '#f5f5f4', '#e4e3e2'],
  ])('resolves the chosen surfaces for %s', (id, headerBackground, rowStripedBackground, rowHoverBackground) => {
    expect(getThemeById(id).components.table).toMatchObject({
      headerBackground,
      rowStripedBackground,
      rowHoverBackground,
    });
  });

  it('inherits custom theme surfaces and accents before applying partial table overrides', () => {
    const theme = createTheme({
      colors: {
        mode: 'dark',
        background: { primary: '#302030', secondary: '#403040' },
        secondary: { main: '#504050' },
        info: { main: '#ff0000' },
      },
      components: { table: { headerBackground: 'palette.ink700' } },
    });
    expect(theme.components.table).toMatchObject({
      headerBackground: '#202429',
      rowStripedBackground: '#403040',
    });
    expect(createTheme({ colors: { mode: 'dark' } }).components.table.headerBackground).toBe('#2c2f35');
  });

  it('composites a translucent custom header color onto the table surface', () => {
    const table = createTheme({
      colors: {
        mode: 'dark',
        background: { primary: '#000000' },
        secondary: { main: 'rgba(255, 255, 255, 0.1)', shade: 'rgba(255, 255, 255, 0.2)' },
      },
    }).components.table;

    expect(table.headerBackground).toBe('#1a1a1a');
  });

  it('uses the custom Gilded grove table palette', () => {
    expect(getThemeById('gildedgrove').components.table).toMatchObject({
      headerBackground: '#3A2E1B',
      border: '#38443F',
      rowStripedBackground: '#25302C',
      rowHoverBackground: '#3B3527',
      rowSelectedBackground: '#4A3216',
    });
  });

  it('accepts partial table overrides in theme definitions and rejects non-color inputs', () => {
    expect(ThemeComponentsInputSchema.parse({ table: { rowStripedBackground: 'palette.ink750' } })).toEqual({
      table: { rowStripedBackground: 'palette.ink750' },
    });
    expect(ThemeComponentsInputSchema.safeParse({ table: { rowStripedBackground: 123 } }).success).toBe(false);
  });
});
