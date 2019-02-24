import tinycolor from 'tinycolor2';
import defaultTheme from './default';
import { GrafanaTheme, GrafanaThemeType } from '../types/theme';

const basicColors = {
  black: '#000000',
  white: '#ffffff',
  dark1: '#141414',
  dark2: '#161719',
  dark3: '#1f1f20',
  dark4: '#212124',
  dark5: '#222426',
  dark6: '#262628',
  dark7: '#292a2d',
  dark8: '#2f2f32',
  dark9: '#343436',
  dark10: '#424345',
  gray1: '#555555',
  gray2: '#8e8e8e',
  gray3: '#b3b3b3',
  gray4: '#d8d9da',
  gray5: '#ececec',
  gray6: '#f4f5f8', // not used in dark theme
  gray7: '#fbfbfb', // not used in dark theme
  grayBlue: '#212327',
  blueBase: '#3274d9',
  blueShade: '#1f60c4',
  blueLight: '#5794f2',
  blueFaint: '#041126',
  redBase: '#e02f44',
  redShade: '#c4162a',
  greenBase: '#299c46',
  greenShade: '#23843b',
  blue: '#33b5e5',
  red: '#d44a3a',
  yellow: '#ecbb13',
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
    queryRed: basicColors.redBase,
    queryGreen: '#74e680',
    queryPurple: '#fe85fc',
    queryKeyword: '#66d9ef',
    queryOrange: basicColors.orange,
    online: basicColors.greenBase,
    warn: '#f79520',
    critical: basicColors.redBase,
    bodyBg: basicColors.dark2,
    pageBg: basicColors.dark2,
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
    scrollbar: basicColors.dark9,
    scrollbar2: basicColors.dark9,
  },
};

export default darkTheme;
