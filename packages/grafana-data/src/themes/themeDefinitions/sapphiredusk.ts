import { NewThemeOptions } from '../createTheme';

const sapphireDuskTheme: NewThemeOptions = {
  name: 'Sapphire dusk',
  colors: {
    mode: 'dark',
    border: {
      weak: '#232e47',
      medium: '#2c3853',
      strong: '#404d6b',
    },
    text: {
      primary: '#FFFFFF',
      secondary: '#bcccdd',
      disabled: '#838da5',
      link: '#93EBF0',
      maxContrast: '#FFFFFF',
    },
    primary: {
      main: '#93EBF0',
      text: '#a8e9ed',
      border: '#93ebf0',
      name: 'primary',
      shade: '#c0f5d9',
      transparent: '#93EBF029',
      contrastText: '#111614',
      borderTransparent: '#93ebf040',
    },
    secondary: {
      main: '#2c364f',
      shade: '#36415e',
      transparent: 'rgba(200, 200, 180, 0.08)',
      text: '#d1dfff',
      contrastText: '#acfeff',
      border: 'rgba(200, 200, 180, 0.08)',
      name: 'secondary',
      borderTransparent: 'rgba(200, 200, 180, 0.25)',
    },
    info: {
      main: '#4d4593',
      text: '#a8e9ed',
      border: '#5d54a7',
    },
    error: {
      main: '#c63370',
    },
    success: {
      main: '#1A7F4B',
    },
    warning: {
      main: '#D448EA',
    },
    background: {
      canvas: '#1e273d',
      primary: '#12192e',
      secondary: '#212c47',
      elevated: '#212c47',
    },
    action: {
      hover: '#364057',
      selected: '#364260',
      selectedBorder: '#D448EA',
      focus: '#364057',
      hoverOpacity: 0.08,
      disabledText: '#838da5',
      disabledBackground: 'rgba(54, 64, 87, 0.2)',
      disabledOpacity: 0.38,
    },
    gradients: {
      brandHorizontal: 'linear-gradient(270deg, #D346EF 0%, #2C83FE 100%)',
      brandVertical: 'linear-gradient(0deg, #D346EF 0%, #2C83FE 100%)',
    },
    contrastThreshold: 3,
    hoverFactor: 0.03,
    tonalOffset: 0.15,
  },
  shape: {
    borderRadius: 5,
  },
};

export default sapphireDuskTheme;
