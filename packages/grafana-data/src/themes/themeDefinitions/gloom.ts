import { NewThemeOptions } from '../createTheme';

const gildedGroveTheme: NewThemeOptions = {
  name: 'Gloom',
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
      link: '#ff934d',
      maxContrast: '#FFFFFF',
    },
    primary: {
      main: '#ff934d',
      text: '#ff934d',
      border: '#ff934d',
      name: 'primary',
      // shade: 'rgb(255, 173, 80)',
      // transparent: '#FEAC3426',
      //  contrastText: '#111614',
      //  borderTransparent: '#FFD78340',
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
      canvas: '#000',
      primary: '#111',
      secondary: '#222',
    },
    action: {
      hover: 'rgba(200, 200, 180, 0.10)',
      selected: 'rgba(200, 200, 180, 0.12)',
      selectedBorder: '#ff934d',
      focus: 'rgba(200, 200, 180, 0.10)',
      hoverOpacity: 0.08,
      disabledText: 'rgba(200, 200, 180, 0.6)',
      disabledBackground: 'rgba(200, 200, 180, 0.04)',
      disabledOpacity: 0.38,
    },
    gradients: {
      brandHorizontal: 'linear-gradient(270deg, #ff934d 0%, #FEAC34 100%)',
      brandVertical: 'linear-gradient(0.01deg, #ff934d 0.01%, #FEAC34 99.99%)',
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
