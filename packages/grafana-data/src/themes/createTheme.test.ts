import { createTheme } from './createTheme';

describe('createTheme', () => {
  it('create custom theme', () => {
    const custom = createTheme({
      palette: {
        mode: 'dark',
        primary: {
          main: 'rgb(240,0,0)',
        },
        layer0: '#123',
      },
    });

    expect(custom.palette.primary.main).toBe('rgb(240,0,0)');
    expect(custom.palette.primary.shade).toBe('rgb(242, 38, 38)');
    expect(custom.palette.layer0).toBe('#123');
  });

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
          "card": Object {
            "background": "#22252b",
          },
          "dashboard": Object {
            "background": "#0d0f16",
            "padding": 1,
          },
          "dropdown": Object {
            "background": "#22252b",
          },
          "form": Object {
            "background": "#0d0f16",
            "border": "rgba(218,224,254,0.15)",
            "borderHover": "rgba(218,224,254,0.20)",
            "text": "rgba(255, 255, 255, 0.75)",
          },
          "height": Object {
            "lg": 6,
            "md": 4,
            "sm": 3,
          },
          "menu": Object {
            "background": "#22252b",
          },
          "pageToolbar": Object {
            "background": "#0d0f16",
            "border": "none",
            "boxShadow": "none",
          },
          "panel": Object {
            "background": "#181b1f",
            "border": "#181b1f",
            "boxShadow": "0px 1px 1px -1px rgba(0,0,0,0.5),0px 1px 1px 0px rgba(0,0,0,0.4),0px 1px 3px 0px rgba(0,0,0,0.3)",
            "headerHeight": 4,
            "padding": 1,
          },
          "scrollbar": Object {
            "background": "rgba(255,255,255,0.1)",
          },
          "tooltip": Object {
            "background": "#22252b",
            "text": "rgba(255, 255, 255, 0.75)",
          },
        },
        "isDark": true,
        "isLight": false,
        "name": "Dark",
        "palette": Object {
          "action": Object {
            "disabledBackground": "rgba(255,255,255,0.07)",
            "disabledOpacity": 0.38,
            "disabledText": "rgba(255, 255, 255, 0.35)",
            "focus": "rgba(255, 255, 255, 0.16)",
            "hover": "rgba(255, 255, 255, 0.08)",
            "hoverOpacity": 0.08,
            "selected": "rgba(255, 255, 255, 0.12)",
          },
          "border0": "#181b1f",
          "border1": "rgba(218,224,254,0.15)",
          "border2": "rgba(218,224,254,0.20)",
          "contrastThreshold": 3,
          "divider": "rgba(218,224,254,0.06)",
          "error": Object {
            "contrastText": "#fff",
            "main": "#D10E5C",
            "name": "error",
            "shade": "rgb(215, 50, 116)",
            "text": "#FF5286",
          },
          "getContrastText": [Function],
          "getHoverColor": [Function],
          "hoverFactor": 0.15,
          "info": Object {
            "border": "#5790FF",
            "contrastText": "#fff",
            "main": "#4165F5",
            "name": "info",
            "shade": "rgb(93, 124, 246)",
            "text": "#5790FF",
          },
          "layer0": "#0d0f16",
          "layer1": "#181b1f",
          "layer2": "#22252b",
          "mode": "dark",
          "primary": Object {
            "border": "#5790FF",
            "contrastText": "#fff",
            "main": "#4165F5",
            "name": "primary",
            "shade": "rgb(93, 124, 246)",
            "text": "#5790FF",
          },
          "secondary": Object {
            "contrastText": "rgba(255, 255, 255, 0.8)",
            "main": "rgba(255,255,255,0.1)",
            "name": "secondary",
            "shade": "rgba(255,255,255,0.15)",
            "text": "rgba(255,255,255,0.13)",
          },
          "success": Object {
            "contrastText": "#fff",
            "main": "#1A7F4B",
            "name": "success",
            "shade": "rgb(60, 146, 102)",
            "text": "#6CCF8E",
          },
          "text": Object {
            "disabled": "rgba(255, 255, 255, 0.35)",
            "link": "#5790FF",
            "maxContrast": "#fff",
            "primary": "rgba(255, 255, 255, 0.75)",
            "secondary": "rgba(255, 255, 255, 0.50)",
          },
          "tonalOffset": 0.15,
          "warning": Object {
            "contrastText": "#000",
            "main": "#F5B73D",
            "name": "warning",
            "shade": "rgb(246, 193, 90)",
            "text": "#F8D06B",
          },
        },
        "shadows": Object {
          "z0": "0px 1px 1px -1px rgba(0,0,0,0.5),0px 1px 1px 0px rgba(0,0,0,0.4),0px 1px 3px 0px rgba(0,0,0,0.3)",
          "z1": "0px 2px 1px -1px rgba(0,0,0,0.5),0px 1px 1px 0px rgba(0,0,0,0.4),0px 1px 3px 0px rgba(0,0,0,0.3)",
          "z2": "0px 3px 1px -2px rgba(0,0,0,0.5),0px 2px 2px 0px rgba(0,0,0,0.4),0px 1px 5px 0px rgba(0,0,0,0.3)",
          "z3": "0px 2px 4px -1px rgba(0,0,0,0.5),0px 4px 5px 0px rgba(0,0,0,0.4),0px 1px 10px 0px rgba(0,0,0,0.3)",
          "z4": "0px 5px 5px -3px rgba(0,0,0,0.5),0px 8px 10px 1px rgba(0,0,0,0.4),0px 3px 14px 2px rgba(0,0,0,0.3)",
        },
        "shape": Object {
          "borderRadius": [Function],
        },
        "spacing": [Function],
        "transitions": Object {
          "create": [Function],
          "duration": Object {
            "complex": 375,
            "enteringScreen": 225,
            "leavingScreen": 195,
            "short": 250,
            "shorter": 200,
            "shortest": 150,
            "standard": 300,
          },
          "easing": Object {
            "easeIn": "cubic-bezier(0.4, 0, 1, 1)",
            "easeInOut": "cubic-bezier(0.4, 0, 0.2, 1)",
            "easeOut": "cubic-bezier(0.0, 0, 0.2, 1)",
            "sharp": "cubic-bezier(0.4, 0, 0.6, 1)",
          },
          "getAutoHeightDuration": [Function],
        },
        "typography": Object {
          "body": Object {
            "fontFamily": "\\"Roboto\\", \\"Helvetica\\", \\"Arial\\", sans-serif",
            "fontSize": "1rem",
            "fontWeight": 400,
            "letterSpacing": "0.01071em",
            "lineHeight": 1.5,
          },
          "fontFamily": "\\"Roboto\\", \\"Helvetica\\", \\"Arial\\", sans-serif",
          "fontFamilyMonospace": "Menlo, Monaco, Consolas, 'Courier New', monospace",
          "fontSize": 14,
          "fontWeightBold": 700,
          "fontWeightLight": 300,
          "fontWeightMedium": 500,
          "fontWeightRegular": 400,
          "h1": Object {
            "fontFamily": "\\"Roboto\\", \\"Helvetica\\", \\"Arial\\", sans-serif",
            "fontSize": "2rem",
            "fontWeight": 300,
            "letterSpacing": "-0.05357em",
            "lineHeight": 1.167,
          },
          "h2": Object {
            "fontFamily": "\\"Roboto\\", \\"Helvetica\\", \\"Arial\\", sans-serif",
            "fontSize": "1.7142857142857142rem",
            "fontWeight": 300,
            "letterSpacing": "-0.02083em",
            "lineHeight": 1.2,
          },
          "h3": Object {
            "fontFamily": "\\"Roboto\\", \\"Helvetica\\", \\"Arial\\", sans-serif",
            "fontSize": "1.5rem",
            "fontWeight": 400,
            "letterSpacing": "0em",
            "lineHeight": 1.167,
          },
          "h4": Object {
            "fontFamily": "\\"Roboto\\", \\"Helvetica\\", \\"Arial\\", sans-serif",
            "fontSize": "1.2857142857142858rem",
            "fontWeight": 400,
            "letterSpacing": "0.01389em",
            "lineHeight": 1.235,
          },
          "h5": Object {
            "fontFamily": "\\"Roboto\\", \\"Helvetica\\", \\"Arial\\", sans-serif",
            "fontSize": "1.1428571428571428rem",
            "fontWeight": 400,
            "letterSpacing": "0em",
            "lineHeight": 1.334,
          },
          "h6": Object {
            "fontFamily": "\\"Roboto\\", \\"Helvetica\\", \\"Arial\\", sans-serif",
            "fontSize": "1rem",
            "fontWeight": 500,
            "letterSpacing": "0.01071em",
            "lineHeight": 1.6,
          },
          "htmlFontSize": 14,
          "pxToRem": [Function],
          "size": Object {
            "base": "14px",
            "lg": "18px",
            "md": "14px",
            "sm": "12px",
            "xs": "10px",
          },
        },
        "zIndex": Object {
          "dropdown": 1030,
          "modal": 1060,
          "modalBackdrop": 1050,
          "navbarFixed": 1000,
          "sidemenu": 1020,
          "tooltip": 1040,
          "typeahead": 1030,
        },
      }
    `);
  });
});
