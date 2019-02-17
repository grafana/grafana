import tinycolor from 'tinycolor2';
import defaultTheme from './default';
import { GrafanaTheme, GrafanaThemeType } from '../types/theme';

const basicColors = {
  black: '#000000',
  white: '#ffffff',
  dark1: '#13161d',
  dark2: '#1e2028',
  dark3: '#303133',
  dark4: '#35373f',
  dark5: '#41444b',
  gray1: '#52545c',
  gray2: '#767980',
  gray3: '#acb6bf',
  gray4: '#c7d0d9',
  gray5: '#dde4ed',
  gray6: '#e9edf2',
  gray7: '#f7f8fa',
  grayBlue: '#212327', // not used in light theme
  blue: '#0083b3',
  blueDark: '#005f81',
  blueLight: '#00a8e6',
  green: '#3aa655',
  red: '#d44939',
  yellow: '#ff851b',
  pink: '#e671b8',
  purple: '#9954bb',
  variable: '#0083b3',
  orange: '#ff7941',
};

const lightTheme: GrafanaTheme = {
  ...defaultTheme,
  type: GrafanaThemeType.Light,
  name: 'Grafana Light',
  colors: {
    ...basicColors,
    variable: basicColors.blue,
    inputBlack: '#09090b',
    queryRed: basicColors.red,
    queryGreen: basicColors.green,
    queryPurple: basicColors.purple,
    queryKeyword: basicColors.blue,
    queryOrange: basicColors.orange,
    online: '#01a64f',
    warn: '#f79520',
    critical: '#ec2128',
    bodyBg: basicColors.gray7,
    pageBg: basicColors.gray7,
    bodyColor: basicColors.gray1,
    textColor: basicColors.gray1,
    textColorStrong: basicColors.dark2,
    textColorWeak: basicColors.gray2,
    textColorEmphasis: basicColors.gray5,
    textColorFaint: basicColors.dark4,
    linkColor: basicColors.gray1,
    linkColorDisabled: new tinycolor(basicColors.gray1).lighten(30).toString(),
    linkColorHover: new tinycolor(basicColors.gray1).darken(20).toString(),
    linkColorExternal: basicColors.blueLight,
    headingColor: basicColors.gray1,
  },
  background: {
    dropdown: basicColors.white,
    scrollbar: basicColors.gray5,
    scrollbar2: basicColors.gray5,
  },
};

export default lightTheme;
