import { ThemeComponentsInputSchema } from './createComponents';
import { createTheme } from './createTheme';
import { getThemeById } from './registry';

describe('table colors', () => {
  it.each([
    ['dark', '#2c2f35', '#22252b'],
    ['light', '#ececed', '#f4f5f5'],
    ['visual_refresh_dark', '#202429', '#191d22'],
    ['visual_refresh_light', '#f0f0ef', '#f5f5f4'],
  ])('resolves the chosen surfaces for %s', (id, headerBackground, rowStripedBackground) => {
    expect(getThemeById(id).components.table).toMatchObject({ headerBackground, rowStripedBackground });
  });

  it('inherits custom theme surfaces and accents before applying partial table overrides', () => {
    const theme = createTheme({
      colors: {
        mode: 'dark',
        background: { primary: '#302030', secondary: '#403040' },
        secondary: { main: '#504050' },
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

  it('accepts partial table overrides in theme definitions and rejects non-color inputs', () => {
    expect(ThemeComponentsInputSchema.parse({ table: { rowStripedBackground: 'palette.ink750' } })).toEqual({
      table: { rowStripedBackground: 'palette.ink750' },
    });
    expect(ThemeComponentsInputSchema.safeParse({ table: { rowStripedBackground: 123 } }).success).toBe(false);
  });
});
