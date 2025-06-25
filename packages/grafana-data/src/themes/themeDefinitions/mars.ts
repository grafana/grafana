import { NewThemeOptions } from '../createTheme';

const marsTheme: NewThemeOptions = {
  name: 'Mars',
  colors: {
    mode: 'dark',
    border: {
      weak: 'rgba(210, 90, 60, 0.2)',
      medium: 'rgba(210, 90, 60, 0.35)',
      strong: 'rgba(210, 90, 60, 0.5)',
    },
    text: {
      primary: '#DDDDDD',
      secondary: '#BBBBBB',
      disabled: 'rgba(221, 221, 221, 0.5)',
      link: '#FF6F61',
      maxContrast: '#FFFFFF',
    },
    primary: {
      main: '#FF6F61',
    },
    secondary: {
      main: '#6a2f2f',
      text: '#BBBBBB',
      border: 'rgba(210, 90, 60, 0.2)',
    },
    background: {
      canvas: '#3C1E1E',
      primary: '#522626',
      secondary: '#6A2F2F',
      elevated: '#6A2F2F',
    },
    action: {
      hover: 'rgba(210, 90, 60, 0.16)',
      selected: 'rgba(210, 90, 60, 0.12)',
      selectedBorder: '#FF6F61',
      focus: 'rgba(210, 90, 60, 0.16)',
      hoverOpacity: 0.08,
      disabledText: 'rgba(221, 221, 221, 0.5)',
      disabledBackground: 'rgba(210, 90, 60, 0.08)',
      disabledOpacity: 0.38,
    },
    gradients: {
      brandHorizontal: 'linear-gradient(270deg, #FF6F61 0%, #D25A3C 100%)',
      brandVertical: 'linear-gradient(0.01deg, #FF6F61 0.01%, #D25A3C 99.99%)',
    },
    contrastThreshold: 3,
    hoverFactor: 0.05,
    tonalOffset: 0.2,
  },
  shape: {
    borderRadius: 4,
  },
};

export default marsTheme;
