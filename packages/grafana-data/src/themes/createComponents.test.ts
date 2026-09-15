import { ThemeComponentsInputSchema } from './createComponents';
import { createTheme } from './createTheme';
import { getThemeById } from './registry';

describe('table colors', () => {
  it.each([
    ['dark', '#181b1f', '#2c2f35', '#22252b', '#111217'],
    ['light', '#ffffff', '#ececed', '#f4f5f5', '#fbfbfb'],
    ['visual_refresh_dark', '#111419', '#202429', '#191d22', '#090b0f'],
    ['visual_refresh_light', '#ffffff', '#f0f0ef', '#f5f5f4', '#fafafa'],
  ])(
    'resolves the chosen surfaces for %s',
    (id, background, headerBackground, rowStripedBackground, backgroundOnCanvas) => {
      expect(getThemeById(id).components.table).toMatchObject({
        background,
        headerBackground,
        rowStripedBackground,
        backgroundOnCanvas,
      });
    }
  );

  it('inherits custom theme surfaces and accents before applying partial table overrides', () => {
    const theme = createTheme({
      colors: {
        mode: 'dark',
        background: { primary: '#302030', secondary: '#403040', canvas: '#201020' },
        secondary: { main: '#504050' },
        info: { main: '#ff0000' },
      },
      components: { table: { headerBackground: 'palette.ink700', background: undefined } },
    });
    expect(theme.components.table).toMatchObject({
      background: '#302030',
      backgroundOnCanvas: '#201020',
      headerBackground: '#202429',
      rowStripedBackground: '#403040',
      cellSelectionBorder: '#ff000026',
    });
    expect(createTheme({ colors: { mode: 'dark' } }).components.table.headerBackground).toBe('#2c2f35');
  });

  it('accepts partial table overrides in theme definitions and rejects non-color inputs', () => {
    expect(ThemeComponentsInputSchema.parse({ table: { rowStripedBackground: 'palette.ink750' } })).toEqual({
      table: { rowStripedBackground: 'palette.ink750' },
    });
    expect(ThemeComponentsInputSchema.safeParse({ table: { rowStripedBackground: 123 } }).success).toBe(false);
  });
});
