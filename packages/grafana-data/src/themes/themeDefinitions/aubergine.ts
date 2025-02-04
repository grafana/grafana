import { NewThemeOptions } from '../createTheme';

const aubergineTheme: NewThemeOptions = {
  name: 'Aubergine',
  colors: {
    mode: 'dark',
    border: {
      weak: '#8C5A69',
      medium: '#6A3C4B',
      strong: '#4F2A3D',
    },
    text: {
      primary: '#E5D0D6',
      secondary: '#D1A8C4',
      disabled: '#B7A0A6',
      link: '#A56BB6',
      maxContrast: '#FFFFFF',
    },
    primary: {
      main: '#6A3C4B',
    },
    secondary: {
      main: '#8C5A69',
    },
    info: {
      main: '#6D76D1',
    },
    error: {
      main: '#E53935',
    },
    success: {
      main: '#388E3C',
    },
    warning: {
      main: '#FFB300',
    },
    background: {
      canvas: '#2E1F2D',
      primary: '#3C2136',
      secondary: '#4A2D47',
    },
    action: {
      hover: '#6A3C4B',
      selected: '#8C5A69',
      selectedBorder: '#FFB300',
      focus: '#A56BB6',
      hoverOpacity: 0.1,
      disabledText: '#B7A0A6',
      disabledBackground: '#4A2D47',
      disabledOpacity: 0.38,
    },
    gradients: {
      brandHorizontal: 'linear-gradient(270deg, #6A3C4B 0%, #8C5A69 100%)',
      brandVertical: 'linear-gradient(0.01deg, #6A3C4B 0.01%, #8C5A69 99.99%)',
    },
    contrastThreshold: 4,
    hoverFactor: 0.07,
    tonalOffset: 0.15,
  },
  shape: {
    borderRadius: 6,
  },
  typography: {
    fontFamily: '"Roboto", "Arial", sans-serif',
    fontFamilyMonospace: "'Courier New', monospace",
    fontSize: 14,
    fontWeightLight: 300,
    fontWeightRegular: 400,
    fontWeightMedium: 500,
    fontWeightBold: 700,
  },
};

export default aubergineTheme;
