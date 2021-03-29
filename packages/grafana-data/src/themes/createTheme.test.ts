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
        "components": Object {
          "height": Object {
            "lg": 6,
            "md": 4,
            "sm": 3,
          },
          "panel": Object {
            "headerHeight": 4,
            "padding": 1,
          },
        },
        "isDark": true,
        "isLight": false,
        "name": "Dark",
        "palette": Object {
          "background": Object {
            "layer0": "#0b0c0e",
            "layer1": "#141619",
            "layer2": "#202226",
          },
          "border": Object {
            "layer0": "#202226",
            "layer1": "#2c3235",
            "layer2": "#464c54",
          },
          "contrastThreshold": 3,
          "error": Object {
            "border": "#FF5286",
            "contrastText": "#fff",
            "main": "#D10E5C",
            "name": "error",
            "text": "#FF5286",
          },
          "formComponent": Object {
            "background": "#0b0c0e",
            "border": "#2c3235",
            "disabledBackground": "#141619",
          },
          "getContrastText": [Function],
          "getHoverBackground": [Function],
          "hoverFactor": 0.15,
          "info": Object {
            "border": "#5B93FF",
            "contrastText": "#fff",
            "main": "#3658E2",
            "name": "info",
            "text": "#5B93FF",
          },
          "mode": "dark",
          "primary": Object {
            "border": "#5B93FF",
            "contrastText": "#fff",
            "main": "#3658E2",
            "name": "primary",
            "text": "#5B93FF",
          },
          "secondary": Object {
            "border": "rgba(255,255,255,0.1)",
            "contrastText": "rgba(255, 255, 255, 0.8)",
            "main": "rgba(255,255,255,0.1)",
            "name": "secondary",
            "text": "rgba(255,255,255,0.1)",
          },
          "success": Object {
            "border": "#6CCF8E",
            "contrastText": "#fff",
            "main": "#13875D",
            "name": "success",
            "text": "#6CCF8E",
          },
          "text": Object {
            "disabled": "rgba(255, 255, 255, 0.3)",
            "link": "#5B93FF",
            "primary": "rgba(255, 255, 255, 0.75)",
            "secondary": "rgba(255, 255, 255, 0.50)",
          },
          "tonalOffset": 0.1,
          "warning": Object {
            "border": "#eb7b18",
            "contrastText": "#000",
            "main": "#eb7b18",
            "name": "warning",
            "text": "#eb7b18",
          },
        },
        "shape": Object {
          "borderRadius": [Function],
        },
        "spacing": [Function],
      }
    `);
  });
});
