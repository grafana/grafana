import { NewThemeOptions } from '../createTheme';

const gildedGroveTheme: NewThemeOptions = {
  name: 'Gilded grove',
  colors: {
    mode: 'dark',
    border: {
      weak: 'rgba(200, 200, 180, 0.12)',
      medium: 'rgba(200, 200, 180, 0.20)',
      strong: 'rgba(200, 200, 180, 0.30)',
    },
    text: {
      primary: 'rgb(250, 250, 239)',
      secondary: 'rgba(200, 200, 180, 0.85)',
      disabled: 'rgba(200, 200, 180, 0.6)',
      link: '#FEAC34',
      maxContrast: '#FFFFFF',
    },
    primary: {
      main: '#FEAC34',
      text: '#FFD783',
      border: '#FFD783',
      name: 'primary',
      shade: 'rgb(255, 173, 80)',
      transparent: '#FEAC3426',
      contrastText: '#111614',
      borderTransparent: '#FFD78340',
    },
    secondary: {
      main: 'rgba(200, 200, 180, 0.10)',
      shade: 'rgba(200, 200, 180, 0.14)',
      transparent: 'rgba(200, 200, 180, 0.08)',
      text: 'rgb(200, 200, 180)',
      contrastText: 'rgb(200, 200, 180)',
      border: 'rgba(200, 200, 180, 0.08)',
      name: 'secondary',
      borderTransparent: 'rgba(200, 200, 180, 0.25)',
    },
    background: {
      canvas: '#111614',
      primary: '#1d2220',
      secondary: '#27312E',
      elevated: '#27312E',
    },
    action: {
      hover: 'rgba(200, 200, 180, 0.16)',
      selected: 'rgba(200, 200, 180, 0.12)',
      selectedBorder: '#FEAC34',
      focus: 'rgba(200, 200, 180, 0.16)',
      hoverOpacity: 0.08,
      disabledText: 'rgba(200, 200, 180, 0.6)',
      disabledBackground: 'rgba(200, 200, 180, 0.04)',
      disabledOpacity: 0.38,
    },
    gradients: {
      brandHorizontal: 'linear-gradient(270deg, #FEAC34 0%, #FFD783 100%)',
      brandVertical: 'linear-gradient(0.01deg, #FEAC34 0.01%, #FFD783 99.99%)',
    },
    contrastThreshold: 3,
    hoverFactor: 0.03,
    tonalOffset: 0.15,
  },
  shape: {
    borderRadius: 5,
  },
};

export default gildedGroveTheme;
