import { NewThemeOptions } from '../createTheme';

const aubergineTheme: NewThemeOptions = {
  name: 'Aubergine',
  colors: {
    mode: 'dark',
    border: {
      weak: '#4F2A3D',
      medium: '#6A3C4B',
      strong: '#8C5A69',
    },
    text: {
      primary: '#E5D0D6',
      secondary: '#D1A8C4',
      disabled: '#B7A0A6',
      link: '#A56BB6',
      maxContrast: '#FFFFFF',
    },
    primary: {
      main: '#8C5A69',
    },
    secondary: {
      main: '#6A3C4B',
      text: '#D1A8C4',
      border: '#8C5A69',
    },
    background: {
      canvas: '#2E1F2D',
      primary: '#3C2136',
      secondary: '#4A2D47',
      elevated: '#4A2D47',
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
      brandHorizontal: 'linear-gradient(270deg, #6A3C4B 0%, #A56BB6 100%)',
      brandVertical: 'linear-gradient(0deg, #6A3C4B 0%, #A56BB6 100%)',
    },
    contrastThreshold: 4,
    hoverFactor: 0.07,
    tonalOffset: 0.15,
  },
  shape: {
    borderRadius: 6,
  },
};

export default aubergineTheme;
