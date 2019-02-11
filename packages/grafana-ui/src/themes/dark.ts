import tinycolor  from 'tinycolor2';
import defaultTheme from './default';
import { GrafanaTheme, GrafanaThemeType } from '../types/theme';

const basicColors = {
  black: '#000000',
  white: '#ffffff',
  dark1: '#141414',
  dark2: '#1f1f20',
  dark3: '#262628',
  dark4: '#333333',
  dark5: '#444444',
  gray1: '#555555',
  gray2: '#8e8e8e',
  gray3: '#b3b3b3',
  gray4: '#d8d9da',
  gray5: '#ececec',
  gray6: '#f4f5f8',
  gray7: '#fbfbfb',
  grayBlue: '#212327',
  blue: '#33b5e5',
  blueDark: '#005f81',
  blueLight: '#00a8e6', // not used in dark theme
  green: '#299c46',
  red: '#d44a3a',
  yellow: '#ecbb13',
  pink: '#ff4444',
  purple: '#9933cc',
  variable: '#32d1df',
  orange: '#eb7b18',
};

const darkTheme: GrafanaTheme = {
  ...defaultTheme,
  type: GrafanaThemeType.Dark,
  name: 'Grafana Dark',
  colors: {
    ...basicColors,
    inputBlack: '#09090b',
    queryRed: '#e24d42',
    queryGreen: '#74e680',
    queryPurple: '#fe85fc',
    queryKeyword: '#66d9ef',
    queryOrange: 'eb7b18',
    online: '#10a345',
    warn: '#f79520',
    critical: '#ed2e18',
    bodyBg: '#171819',
    pageBg: '#161719',
    bodyColor: basicColors.gray4,
    textColor: basicColors.gray4,
    textColorStrong: basicColors.white,
    textColorWeak: basicColors.gray2,
    textColorEmphasis: basicColors.gray5,
    textColorFaint: basicColors.dark5,
    linkColor: new tinycolor(basicColors.white).darken(11).toString(),
    linkColorDisabled: new tinycolor(basicColors.white).darken(11).toString(),
    linkColorHover: basicColors.white,
    linkColorExternal: basicColors.blue,
    headingColor: new tinycolor(basicColors.white).darken(11).toString(),
  },
  background: {
    dropdown: basicColors.dark3,
    scrollbar: '#aeb5df',
    scrollbar2: '#3a3a3a',
  },
};

export default darkTheme;
