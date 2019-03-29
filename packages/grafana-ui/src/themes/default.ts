import { GrafanaThemeCommons } from '../types/theme';

const theme: GrafanaThemeCommons = {
  name: 'Grafana Default',
  typography: {
    fontFamily: {
      sansSerif: "'Roboto', 'Helvetica Neue', Arial, sans-serif",
      monospace: "Menlo, Monaco, Consolas, 'Courier New', monospace",
    },
    size: {
      root: '14px',
      base: '13px',
      xs: '10px',
      sm: '12px',
      md: '14px',
      lg: '18px',
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
      regular: 400,
      semibold: 500,
    },
    lineHeight: {
      xs: 1,
      sm: 1.1,
      md: 4 / 3,
      lg: 1.5,
    },
    link: {
      decoration: 'none',
      hoverDecoration: 'none',
    },
  },
  breakpoints: {
    xs: '0',
    sm: '544px',
    md: '768px',
    lg: '992px',
    xl: '1200px',
  },
  spacing: {
    insetSquishMd: '4px 8px',
    d: '14px',
    xxs: '2px',
    xs: '4px',
    sm: '8px',
    md: '16px',
    lg: '24px',
    xl: '32px',
    gutter: '30px',
  },
  border: {
    radius: {
      sm: '2px',
      md: '3px',
      lg: '5px',
    },
    width: {
      sm: '1px',
    },
  },
  panelPadding: {
    horizontal: 10,
    vertical: 5,
  },
  zIndex: {
    dropdown: '1000',
    navbarFixed: '1020',
    sidemenu: '1025',
    tooltip: '1030',
    modalBackdrop: '1040',
    modal: '1050',
    typeahead: '1060',
  },
};

export default theme;
