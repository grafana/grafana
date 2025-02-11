import { NewThemeOptions } from '../createTheme';

/**
 * a very ugly theme that is useful for debugging and checking if the theme is applied correctly
 * borders are red,
 * backgrounds are blue,
 * text is yellow,
 * and grafana loves you <3
 * (also corners are rounded, action states (hover, focus, selected) are purple)
 */
const debugTheme: NewThemeOptions = {
  name: 'Debug',
  colors: {
    mode: 'dark',
    background: {
      canvas: '#000033',
      primary: '#000044',
      secondary: '#000055',
      elevated: '#000055',
    },
    text: {
      primary: '#bbbb00',
      secondary: '#888800',
      disabled: '#444400',
      link: '#dddd00',
      maxContrast: '#ffff00',
    },
    border: {
      weak: '#ff000044',
      medium: '#ff000088',
      strong: '#ff0000ff',
    },
    primary: {
      border: '#ff000088',
      text: '#cccc00',
      contrastText: '#ffff00',
      shade: '#9900dd',
    },
    secondary: {
      border: '#ff000088',
      text: '#cccc00',
      contrastText: '#ffff00',
      shade: '#9900dd',
    },
    info: {
      shade: '#9900dd',
    },
    warning: {
      shade: '#9900dd',
    },
    success: {
      shade: '#9900dd',
    },
    error: {
      shade: '#9900dd',
    },
    action: {
      hover: '#9900dd',
      focus: '#6600aa',
      selected: '#440088',
    },
  },
  shape: {
    borderRadius: 8,
  },
  spacing: {
    gridSize: 10,
  },
};

export default debugTheme;
