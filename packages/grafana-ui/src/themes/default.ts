import { GrafanaThemeCommons } from '@grafana/data';

export const commonColorsPalette = {
  // New greys palette used by next-gen form elements
  gray98: '#f7f8fa',
  gray97: '#f1f5f9',
  gray95: '#e9edf2',
  gray90: '#dce1e6',
  gray85: '#c7d0d9',
  gray70: '#9fa7b3',
  gray60: '#7b8087',
  gray33: '#464c54',
  gray25: '#2c3235',
  gray15: '#202226',
  gray10: '#141619',
  gray05: '#0b0c0e',

  // New blues palette used by next-gen form elements
  blue95: '#5794f2', // blue95
  blue85: '#33a2e5', // blueText
  blue80: '#3274d9', // blue80
  blue77: '#1f60c4', // blue77

  // New reds palette used by next-gen form elements
  red88: '#e02f44',
};

const SPACING_BASE = 8;

const theme: GrafanaThemeCommons = {
  name: 'Grafana Default',
  typography: {
    fontFamily: {
      sansSerif: '"Inter", "Helvetica", "Arial", sans-serif',
      monospace: "'Roboto Mono', monospace",
    },
    size: {
      base: '14px',
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
      bold: 500,
    },
    lineHeight: {
      xs: 1,
      sm: 1.1,
      md: 1.5,
      lg: 2,
    },
    link: {
      decoration: 'none',
      hoverDecoration: 'none',
    },
  },
  breakpoints: {
    xs: '0',
    sm: '544px',
    md: '769px', // 1 more than regular ipad in portrait
    lg: '992px',
    xl: '1200px',
    xxl: '1440px',
  },
  spacing: {
    base: SPACING_BASE,
    insetSquishMd: '4px 8px',
    d: '16px',
    xxs: '2px',
    xs: '4px',
    sm: '8px',
    md: '16px',
    lg: '24px',
    xl: '32px',
    gutter: '30px',

    // Next-gen forms spacing variables
    // TODO: Move variables definition to respective components when implementing
    formSpacingBase: SPACING_BASE,
    formMargin: `${SPACING_BASE * 4}px`,
    formFieldsetMargin: `${SPACING_BASE * 2}px`,
    formInputHeight: SPACING_BASE * 4,
    formButtonHeight: SPACING_BASE * 4,
    formInputPaddingHorizontal: `${SPACING_BASE}px`,

    // Used for icons do define spacing between icon and input field
    // Applied on the right(prefix) or left(suffix)
    formInputAffixPaddingHorizontal: `${SPACING_BASE / 2}px`,

    formInputMargin: `${SPACING_BASE * 2}px`,
    formLabelPadding: '0 0 0 2px',
    formLabelMargin: `0 0 ${SPACING_BASE / 2 + 'px'} 0`,
    formValidationMessagePadding: '4px 8px',
    formValidationMessageMargin: '4px 0 0 0',
    inlineFormMargin: '4px',
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
  height: {
    sm: 24,
    md: 32,
    lg: 48,
  },
  panelPadding: 8,
  panelHeaderHeight: 28,
  zIndex: {
    navbarFixed: 1000,
    sidemenu: 1020,
    dropdown: 1030,
    typeahead: 1030,
    tooltip: 1040,
    modalBackdrop: 1050,
    modal: 1060,
    portal: 1061,
  },
};

export default theme;
