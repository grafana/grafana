import { NewThemeOptions } from '../createTheme';

const matrixTheme: NewThemeOptions = {
  name: 'Matrix',
  colors: {
    mode: 'dark',
    background: {
      canvas: '#000000',
      primary: '#010101',
      secondary: '#020202',
    },
    text: {
      primary: '#008f11',
      secondary: '#008f11',
      disabled: '#008f11',
      link: '#00ff41',
      maxContrast: '#00ff41',
    },
    border: {
      weak: '#008f1144',
      medium: '#008f1188',
      strong: '#008f11ff',
    },
    primary: {
      main: '#008f11',
    },
    gradients: {
      brandVertical: 'linear-gradient(0deg, #008f11 0%, #00ff41 100%)',
      brandHorizontal: 'linear-gradient(90deg, #008f11 0%, #00ff41 100%)',
    },
  },
  shape: {
    borderRadius: 0,
  },
  typography: {
    fontFamily: 'monospace',
  },
};

export default matrixTheme;
