import { NewThemeOptions } from '../createTheme';

const zenTheme: NewThemeOptions = {
  name: 'Zen',
  colors: {
    mode: 'light',
    text: {
      primary: '#333333',
      secondary: '#666666',
      disabled: '#B8B8B8',
      link: '#4F9F6E',
      maxContrast: '#000000',
    },
    border: {
      weak: '#B1B7B3',
      medium: '#A2A8A2',
      strong: '#7C7F7A',
    },
    primary: {
      main: '#6D8E6D',
    },
    secondary: {
      main: '#E0E0E0',
      text: '#666666',
      border: '#A2A8A2',
    },
    background: {
      canvas: '#F4F4F4',
      primary: '#E9E9E9',
      secondary: '#D8D8D8',
      elevated: '#E9E9E9',
    },
    action: {
      hover: '#D1D1D1',
      selected: '#B8B8B8',
      selectedBorder: '#88B88B',
      hoverOpacity: 0.1,
      focus: '#D1D1D1',
      disabledBackground: '#E0E0E0',
      disabledText: '#B8B8B8',
      disabledOpacity: 0.5,
    },
    gradients: {
      brandHorizontal: 'linear-gradient(270deg, #88B88B 0%, #6D8E6D 100%)',
      brandVertical: 'linear-gradient(0.01deg, #88B88B 0.01%, #6D8E6D 99.99%)',
    },
    contrastThreshold: 3,
    hoverFactor: 0.03,
    tonalOffset: 0.2,
  },
  shape: {
    borderRadius: 8,
  },
};

export default zenTheme;
