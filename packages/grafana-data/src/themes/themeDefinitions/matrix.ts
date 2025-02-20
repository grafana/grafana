import { NewThemeOptions } from '../createTheme';

const matrixTheme: NewThemeOptions = {
  name: 'Matrix',
  colors: {
    mode: 'dark',
    background: {
      canvas: '#000000',
      primary: '#020202',
      secondary: '#080808',
      elevated: '#080808',
    },
    text: {
      primary: '#00c017',
      secondary: '#008910',
      disabled: '#006a0c',
      link: '#00ff41',
      maxContrast: '#00ff41',
    },
    border: {
      weak: '#008f1144',
      medium: '#008f1188',
      strong: '#008910',
    },
    primary: {
      main: '#008910',
    },
    secondary: {
      text: '#008910',
    },
    gradients: {
      brandVertical: 'linear-gradient(0deg, #008910 0%, #00ff41 100%)',
      brandHorizontal: 'linear-gradient(90deg, #008910 0%, #00ff41 100%)',
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
