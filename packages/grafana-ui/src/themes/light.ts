import defaultTheme from './default';
import { GrafanaTheme, GrafanaThemeType } from '../types/theme';

const basicColors = {
  black: '#000000',
  white: '#ffffff',
  dark1: '#1e2028',
  dark2: '#41444b',
  dark3: '#303133', // not used in light theme
  dark4: '#35373f', // not used in light theme
  dark5: '#41444b', // not used in light theme
  dark6: '#41444b', // not used in light theme
  dark7: '#41444b', // not used in light theme
  dark8: '#2f2f32', // not used in light theme
  dark9: '#343436', // not used in light theme
  dark10: '#424345', // not used in light theme
  gray1: '#e4e2e2', //ILLIG Grau 1 228,226,226
  gray2: '#58585a', //ILLIG Grau 2 88,88,90
  gray3: '#d4d3d2', //ILLIG secondary gray 212,211,210
  gray4: '#c7d0d9',
  gray5: '#dde4ed',
  gray6: '#e9edf2',
  gray7: '#f7f8fa',
  grayBlue: '#212327', // not used in light theme
  blueBase: '#00457b', //ILLIG Blue 0,69,123
  blueShade: '#66839d', //ILLIG secondary mid blue 102,131,157
  blueLight: '#d0d8e0', //ILLIG secondary light blue 208,216,224
  blueFaint: '#f5f9ff',
  redBase: '#79132c', //ILLIG Bordeaux 121,19,44
  redShade: '#c4162a',
  greenBase: '#3eb15b',
  greenShade: '#369b4f',
  blue: '#0083b3',
  red: '#d44939',
  yellow: '#ff851b',
  purple: '#9954bb',
  variable: '#007580',
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
    brandPrimary: basicColors.orange,
    brandSuccess: basicColors.greenBase,
    brandWarning: basicColors.orange,
    brandDanger: basicColors.redBase,
    queryRed: basicColors.redBase,
    queryGreen: basicColors.greenBase,
    queryPurple: basicColors.purple,
    queryKeyword: basicColors.blueBase,
    queryOrange: basicColors.orange,
    online: basicColors.greenShade,
    warn: '#f79520',
    critical: basicColors.redShade,
    bodyBg: basicColors.gray7,
    pageBg: basicColors.gray7,
    body: basicColors.gray2,
    text: basicColors.gray2,
    textStrong: basicColors.dark2,
    textWeak: basicColors.gray2,
    textEmphasis: basicColors.dark5,
    textFaint: basicColors.dark4,
    link: basicColors.gray2,
    linkDisabled: basicColors.gray3,
    linkHover: basicColors.dark1,
    linkExternal: basicColors.blueLight,
    headingColor: basicColors.gray2,
  },
  background: {
    dropdown: basicColors.white,
    scrollbar: basicColors.gray5,
    scrollbar2: basicColors.gray5,
  },
};

export default lightTheme;
