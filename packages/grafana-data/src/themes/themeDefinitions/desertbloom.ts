import { NewThemeOptions } from '../createTheme';

const desertBloomTheme: NewThemeOptions = {
  name: 'Desert bloom',
  colors: {
    mode: 'light',
    border: {
      weak: 'rgba(0, 0, 0, 0.12)',
      medium: 'rgba(0, 0, 0, 0.20)',
      strong: 'rgba(0, 0, 0, 0.30)',
    },
    text: {
      primary: '#333333',
      secondary: '#555555',
      disabled: 'rgba(0, 0, 0, 0.5)',
      link: '#1A82E2',
      maxContrast: '#000000',
    },
    primary: {
      main: '#FF6F61',
      text: '#FE6F61',
      border: '#E55B4D',
      name: 'primary',
      shade: '#E55B4D',
      transparent: '#FF6F6126',
      contrastText: '#FFFFFF',
      borderTransparent: '#FF6F6140',
    },
    secondary: {
      main: '#FFFFFF',
      text: '#695f53',
      border: '#d9cec0',
      name: 'secondary',
      shade: '#d9cec0',
      transparent: '#FFFFFF26',
      contrastText: '#4c4339',
      borderTransparent: '#FFFFFF40',
    },
    info: {
      main: '#1A82E2',
    },
    success: {
      main: '#4CAF50',
    },
    warning: {
      main: '#FFC107',
    },
    background: {
      canvas: '#FFF8F0',
      primary: '#FFFFFF',
      secondary: '#f9f3e8',
      elevated: '#FFFFFF',
    },
    action: {
      hover: 'rgba(168, 156, 134, 0.12)',
      selected: 'rgba(168, 156, 134, 0.36)',
      selectedBorder: '#FF6F61',
      focus: 'rgba(168, 156, 134, 0.50)',
      hoverOpacity: 0.08,
      disabledText: 'rgba(168, 156, 134, 0.5)',
      disabledBackground: 'rgba(168, 156, 134, 0.06)',
      disabledOpacity: 0.38,
    },

    gradients: {
      brandHorizontal: 'linear-gradient(270deg,rgba(255, 111, 97, 1) 0%, rgba(255, 167, 58, 1) 100%)',
      brandVertical: 'linear-gradient(0deg, rgba(255, 111, 97, 1) 0%, rgba(255, 167, 58, 1) 100%)',
    },
    contrastThreshold: 3,
    hoverFactor: 0.03,
    tonalOffset: 0.15,
  },
  shape: {
    borderRadius: 6,
  },
};

export default desertBloomTheme;
