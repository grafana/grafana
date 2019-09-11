import defaultTheme from './default';
import { GrafanaTheme, GrafanaThemeType } from '../types/theme';

const basicColors = {
  black: '#000000', //Hintergrundfarbe Sidebar
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
  gray1: '#e4e2e2', //ILLIG Grau 1 228,226,226
  gray2: '#58585a', //ILLIG Grau 2 88,88,90
  gray3: '#d4d3d2', //ILLIG secondary gray 212,211,210
  gray4: '#d8d9da',
  gray5: '#ececec',
  gray6: '#f4f5f8', // not used in dark theme
  gray7: '#fbfbfb', // not used in dark theme
  grayBlue: '#212327',
  blueBase: '#00457b', //ILLIG Blue 0,69,123
  blueShade: '#66839d', //ILLIG secondary mid blue 102,131,157
  blueLight: '#d0d8e0', //ILLIG secondary light blue 208,216,224
  blueFaint: '#041126',
  redBase: '#79132c', //ILLIG Bordeaux 121,19,44
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
    inputBlack: basicColors.blueBase,
    brandPrimary: basicColors.orange,
    brandSuccess: basicColors.greenBase,
    brandWarning: basicColors.orange,
    brandDanger: basicColors.redBase,
    queryRed: basicColors.redBase,
    queryGreen: '#74e680',
    queryPurple: '#fe85fc',
    queryKeyword: '#66d9ef',
    queryOrange: basicColors.orange,
    online: basicColors.greenBase,
    warn: '#f79520',
    critical: basicColors.redBase,
    bodyBg: basicColors.gray1,
    pageBg: basicColors.gray1,
    body: basicColors.gray2, // Überschriften und Bezeichner
    text: basicColors.gray2,
    textStrong: basicColors.gray2,
    textWeak: basicColors.gray2,
    textEmphasis: basicColors.gray2,
    textFaint: basicColors.gray2,
    link: basicColors.yellow,
    linkDisabled: basicColors.gray2,
    linkHover: basicColors.white,
    linkExternal: basicColors.blue,
    headingColor: basicColors.gray2,
  },
  background: {
    dropdown: basicColors.gray1,
    scrollbar: basicColors.gray1,
    scrollbar2: basicColors.gray1,
  },
};

export default darkTheme;
