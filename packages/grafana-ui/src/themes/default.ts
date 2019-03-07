import { GrafanaThemeCommons } from '../types/theme';

const theme: GrafanaThemeCommons = {
  name: 'Grafana Default',
  typography: {
    fontFamily: {
      sansSerif: "'Roboto', Helvetica, Arial, sans-serif",
      monospace: "Menlo, Monaco, Consolas, 'Courier New', monospace",
    },
    size: {
      root: '100%',
      base: '.8125rem',
      xs: '.625rem',
      s: '.75rem',
      m: '.875rem',
      l: '1.125rem',
    },
    heading: {
      h1: '1.75rem',
      h2: '1.5rem',
      h3: '1.3125rem',
      h4: '1.125rem',
      h5: '1rem',
      h6: '.875rem',
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
  brakpoints: {
    xs: '0',
    s: '544px',
    m: '768px',
    l: '992px',
    xl: '1200px',
  },
  spacing: {
    xs: '0',
    s: '0.2rem',
    m: '1rem',
    l: '1.5rem',
    gutter: '30px',
  },
  border: {
    radius: {
      xs: '2px',
      s: '3px',
      m: '5px',
    },
  },
};

export default theme;
