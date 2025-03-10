import { NewThemeOptions } from '../createTheme';

const victorianTheme: NewThemeOptions = {
  name: 'Victorian',
  colors: {
    mode: 'dark',
    border: {
      weak: '#3A2C22',
      medium: '#3A2C22',
      strong: '#4B3D32',
    },
    text: {
      primary: '#D9D0A2',
      secondary: '#C4B89B',
      disabled: '#A89F91',
      link: '#C28A4D',
      maxContrast: '#FFFFFF',
    },
    primary: {
      main: '#C28A4D',
    },
    secondary: {
      main: '#3A2C22',
      text: '#C4B89B',
      border: '#4B3D32',
    },
    background: {
      canvas: '#1F1510',
      primary: '#2C1A13',
      secondary: '#402A21',
      elevated: '#402A21',
    },
    action: {
      hover: '#3A2C22',
      selected: '#4B3D32',
      selectedBorder: '#C28A4D',
      focus: '#C28A4D',
      hoverOpacity: 0.1,
      disabledText: '#A89F91',
      disabledBackground: '#402A21',
      disabledOpacity: 0.38,
    },
    gradients: {
      brandHorizontal: 'linear-gradient(270deg, #D9D0a1 0%, #C28A4D 100%)',
      brandVertical: 'linear-gradient(0.01deg, #D9D0a1 0.01%, #C28A4D 99.99%)',
    },
    contrastThreshold: 4,
    hoverFactor: 0.07,
    tonalOffset: 0.15,
  },
  shape: {
    borderRadius: 6,
  },
  typography: {
    fontFamily: '"Georgia", "Times New Roman", serif',
    fontFamilyMonospace: "'Courier New', monospace",
  },
};

export default victorianTheme;
