import { NewThemeOptions } from '../createTheme';

/**
 * Torkel's GrafanaCon theme
 * very WIP state
 */

const whiteBase = `210, 210, 220`;
const brandMain = '#ff934d';
const brandText = '#f99a5c';

const disabledText = `rgba(${whiteBase}, 0.6)`;

const gloomTheme: NewThemeOptions = {
  name: 'Gloom',
  colors: {
    mode: 'dark',
    border: {
      weak: `rgba(${whiteBase}, 0.08)`,
      medium: `rgba(${whiteBase}, 0.12)`,
      strong: `rgba(${whiteBase}, 0.30)`,
    },

    text: {
      primary: `rgb(${whiteBase})`,
      secondary: `rgba(${whiteBase}, 0.65)`,
      disabled: disabledText,
      link: brandText,
      maxContrast: '#FFF',
    },

    primary: {
      main: brandMain,
      text: brandText,
      border: brandMain,
      name: 'primary',
    },

    secondary: {
      main: `rgba(${whiteBase}, 0.10)`,
      shade: `rgba(${whiteBase}, 0.14)`,
      transparent: `rgba(${whiteBase}, 0.08)`,
      text: `rgba(${whiteBase})`,
      contrastText: `rgb(${whiteBase})`,
      border: `rgba(${whiteBase}, 0.08)`,
    },

    background: {
      canvas: '#000',
      primary: '#111',
      secondary: '#222',
    },

    action: {
      hover: `rgba(${whiteBase}, 0.16)`,
      selected: `rgba(${whiteBase}, 0.12)`,
      selectedBorder: brandMain,
      focus: `rgba(${whiteBase}, 0.16)`,
      hoverOpacity: 0.08,
      disabledText: disabledText,
      disabledBackground: `rgba(${whiteBase}, 0.04)`,
      disabledOpacity: 0.38,
    },

    gradients: {
      brandHorizontal: 'linear-gradient(270deg, #ff934d 0%, #FEAC34 100%)',
      brandVertical: 'linear-gradient(0.01deg, #ff934d 0.01%, #FEAC34 99.99%)',
    },

    contrastThreshold: 3,
    hoverFactor: 0.03,
    tonalOffset: 0.15,
  },
  shape: {
    borderRadius: 5,
  },
};

export default gloomTheme;
