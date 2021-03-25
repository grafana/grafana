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
          "getContrastText": [Function],
          "mode": "dark",
          "primary": Object {
            "main": "#3274d9",
            "name": "primary",
          },
          "secondary": Object {
            "main": "#202226",
            "name": "secondary",
          },
          "text": Object {
            "disabled": "#464c54",
            "primary": "#c7d0d9",
            "secondary": "#7b8087",
          },
        },
        "isDark": true,
        "isLight": false,
        "name": "Dark",
      }
    `);
  });
});
