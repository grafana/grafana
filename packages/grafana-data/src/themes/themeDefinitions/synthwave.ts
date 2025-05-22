import { NewThemeOptions } from '../createTheme';

const synthwaveTheme: NewThemeOptions = {
  name: 'Synthwave',
  colors: {
    mode: 'dark',
    border: {
      weak: 'rgba(255, 20, 147, 0.12)',
      medium: 'rgba(255, 20, 147, 0.20)',
      strong: 'rgba(255, 20, 147, 0.30)',
    },
    text: {
      primary: '#E0E0E0',
      secondary: 'rgba(224, 224, 224, 0.75)',
      disabled: 'rgba(224, 224, 224, 0.5)',
      link: '#FF69B4',
      maxContrast: '#FFFFFF',
    },
    primary: {
      main: '#FF1493',
    },
    secondary: {
      main: '#37183a',
      text: 'rgba(224, 224, 224, 0.75)',
      border: 'rgba(255, 20, 147, 0.10)',
    },
    background: {
      canvas: '#1A1A2E',
      primary: '#16213E',
      secondary: '#0F3460',
      elevated: '#0F3460',
    },
    action: {
      hover: 'rgba(255, 20, 147, 0.16)',
      selected: 'rgba(255, 20, 147, 0.12)',
      selectedBorder: '#FF1493',
      focus: 'rgba(255, 20, 147, 0.16)',
      hoverOpacity: 0.08,
      disabledText: 'rgba(224, 224, 224, 0.5)',
      disabledBackground: 'rgba(255, 20, 147, 0.08)',
      disabledOpacity: 0.38,
    },
    gradients: {
      brandHorizontal: 'linear-gradient(270deg, #FF1493 0%, #1E90FF 100%)',
      brandVertical: 'linear-gradient(0.01deg, #FF1493 0.01%, #1E90FF 99.99%)',
    },
    contrastThreshold: 3,
    hoverFactor: 0.03,
    tonalOffset: 0.15,
  },
  shape: {
    borderRadius: 6,
  },
};

export default synthwaveTheme;
