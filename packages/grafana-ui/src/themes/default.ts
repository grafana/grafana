import { GrafanaThemeCommons } from '../types/theme';

const theme: GrafanaThemeCommons = {
  name: 'Grafana Default',
  typography: {
    fontFamily: {
      sansSerif: "'Roboto', Helvetica, Arial, sans-serif",
      monospace: "Menlo, Monaco, Consolas, 'Courier New', monospace",
    },
    size: {
      root: '14px',
      base: '13px',
      xs: '10px',
      s: '12px',
      m: '14px',
      l: '18px',
    },
    heading: {
      h1: '28px',
      h2: '24px',
      h3: '21px',
      h4: '18px',
      h5: '16px',
      h6: '14px',
    },
    weight: {
      light: 300,
      normal: 400,
      semibold: 500,
    },
    lineHeight: {
      xs: 1,
      s: 1.1,
      m: 4 / 3,
      l: 1.5,
    },
  },
  breakpoints: {
    xs: '0',
    s: '544px',
    m: '768px',
    l: '992px',
    xl: '1200px',
  },
  spacing: {
    xs: '0',
    s: '3px',
    m: '14px',
    l: '21px',
    gutter: '30px',
  },
  border: {
    radius: {
      xs: '2px',
      s: '3px',
      m: '5px',
    },
    width: {
      s: '1px',
    },
  },
};

export default theme;
