import { createTheme } from './createTheme';

describe('createTheme', () => {
  it('create default theme', () => {
    const theme = createTheme();
    expect(theme).toMatchInlineSnapshot(`
      Object {
        "breakpoints": Object {
          "down": [Function],
          "keys": Array [
            "xs",
            "sm",
            "md",
            "lg",
            "xl",
            "xxl",
          ],
          "unit": "px",
          "up": [Function],
          "values": Object {
            "lg": 992,
            "md": 769,
            "sm": 544,
            "xl": 1200,
            "xs": 0,
            "xxl": 1440,
          },
        },
        "colors": Object {
          "background": Object {
            "layer0": "#0b0c0e",
            "layer1": "#141619",
            "layer2": "#202226",
            "layer3": "#2c3235",
          },
          "border": Object {
            "b1": "#141619",
            "b2": "#202226",
            "b3": "#2c3235",
          },
          "contrastThreshold": 3,
          "error": Object {
            "contrastText": "#e02f44",
            "dark": "darken(color.main, tonalOffset)",
            "light": "lighten(color.main, tonalOffset)",
            "main": "#e02f44",
            "name": "error",
          },
          "forHover": [Function],
          "hoverFactor": 1.1,
          "info": Object {
            "contrastText": "#3274d9",
            "dark": "darken(color.main, tonalOffset)",
            "light": "lighten(color.main, tonalOffset)",
            "main": "#3274d9",
            "name": "info",
          },
          "mode": "dark",
          "primary": Object {
            "contrastText": "#3274d9",
            "dark": "darken(color.main, tonalOffset)",
            "light": "lighten(color.main, tonalOffset)",
            "main": "#3274d9",
            "name": "primary",
          },
          "secondary": Object {
            "contrastText": "#202226",
            "dark": "darken(color.main, tonalOffset)",
            "light": "lighten(color.main, tonalOffset)",
            "main": "#202226",
            "name": "secondary",
          },
          "success": Object {
            "contrastText": "#299c46",
            "dark": "darken(color.main, tonalOffset)",
            "light": "lighten(color.main, tonalOffset)",
            "main": "#299c46",
            "name": "success",
          },
          "text": Object {
            "disabled": "rgba(255, 255, 255, 0.4)",
            "primary": "rgba(255, 255, 255, 0.8)",
            "secondary": "rgba(255, 255, 255, 0.6)",
          },
          "textForBg": [Function],
          "warning": Object {
            "contrastText": "#eb7b18",
            "dark": "darken(color.main, tonalOffset)",
            "light": "lighten(color.main, tonalOffset)",
            "main": "#eb7b18",
            "name": "warning",
          },
        },
        "isDark": true,
        "isLight": false,
        "name": "Dark",
        "spacing": [Function],
      }
    `);
  });
});
