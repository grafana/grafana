import { NewThemeOptions } from '../createTheme';

/**
 * Torkel's GrafanaCon theme
 * very WIP state
 */

const whiteBase = `210, 210, 220`;
const secondaryBase = `195, 195, 245`;

//const brandMain = '#3d71d9';
//const brandText = '#6e9fff';
const brandMain = '#ff934d';
const brandText = '#f99a5c';
const disabledText = `rgba(${whiteBase}, 0.48)`;

const gloomTheme: NewThemeOptions = {
  name: 'Gloom',
  colors: {
    mode: 'dark',
    border: {
      weak: `rgba(${whiteBase}, 0.12)`,
      medium: `rgba(${whiteBase}, 0.20)`,
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
      main: `rgba(${secondaryBase}, 0.10)`,
      shade: `rgba(${secondaryBase}, 0.14)`,
      transparent: `rgba(${secondaryBase}, 0.08)`,
      text: `rgba(${secondaryBase})`,
      contrastText: `rgb(${secondaryBase})`,
      border: `rgba(${secondaryBase}, 0.08)`,
    },

    background: {
      canvas: '#000',
      primary: '#121118',
      secondary: '#211e28',
      elevated: '#211e28',
    },

    action: {
      hover: `rgba(${secondaryBase}, 0.07)`,
      selected: `rgba(${secondaryBase}, 0.11)`,
      selectedBorder: brandMain,
      focus: `rgba(${secondaryBase}, 0.07)`,
      hoverOpacity: 0.05,
      disabledText: disabledText,
      disabledBackground: `rgba(${whiteBase}, 0.04)`,
      disabledOpacity: 0.38,
    },

    // gradients: {
    //   brandHorizontal: 'linear-gradient(270deg, #ff934d 0%, #FEAC34 100%)',
    //   brandVertical: 'linear-gradient(0.01deg, #ff934d 0.01%, #FEAC34 99.99%)',
    // },

    contrastThreshold: 3,
    hoverFactor: 0.03,
    tonalOffset: 0.15,
  },
  shape: {
    borderRadius: 5,
  },
};

export default gloomTheme;
