import { NewThemeOptions } from '../createTheme';

const tronTheme: NewThemeOptions = {
  name: 'Tron',
  colors: {
    mode: 'dark',
    border: {
      weak: 'rgba(0, 255, 255, 0.12)',
      medium: 'rgba(0, 255, 255, 0.20)',
      strong: 'rgba(0, 255, 255, 0.30)',
    },
    text: {
      primary: '#E0E0E0',
      secondary: 'rgba(224, 224, 224, 0.75)',
      disabled: 'rgba(224, 224, 224, 0.5)',
      link: '#00FFFF',
      maxContrast: '#FFFFFF',
    },
    primary: {
      main: '#00FFFF',
    },
    secondary: {
      main: '#0b2e36',
      text: 'rgba(224, 224, 224, 0.75)',
      border: 'rgba(0, 255, 255, 0.10)',
    },
    background: {
      canvas: '#0A0F18',
      primary: '#0F1B2A',
      secondary: '#152234',
      elevated: '#152234',
    },
    action: {
      hover: 'rgba(0, 255, 255, 0.16)',
      selected: 'rgba(0, 255, 255, 0.12)',
      selectedBorder: '#00FFFF',
      focus: 'rgba(0, 255, 255, 0.16)',
      hoverOpacity: 0.08,
      disabledText: 'rgba(224, 224, 224, 0.5)',
      disabledBackground: 'rgba(0, 255, 255, 0.08)',
      disabledOpacity: 0.38,
    },
    gradients: {
      brandHorizontal: 'linear-gradient(270deg, #00FFFF 0%, #29ABE2 100%)',
      brandVertical: 'linear-gradient(0.01deg, #00FFFF 0.01%, #29ABE2 99.99%)',
    },
    contrastThreshold: 3,
    hoverFactor: 0.05,
    tonalOffset: 0.2,
  },
  shape: {
    borderRadius: 6,
  },
};

export default tronTheme;
