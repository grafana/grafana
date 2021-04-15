import defaultTheme, { commonColorsPalette } from './default';
import { GrafanaThemeType, GrafanaTheme, createTheme } from '@grafana/data';

const v2 = createTheme({ palette: { mode: 'dark' } });

const basicColors = {
  ...commonColorsPalette,
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
  redBase: '#e02f44',
  redShade: '#c4162a',
  greenBase: '#299c46',
  greenShade: '#23843b',
  red: '#d44a3a',
  yellow: '#ecbb13',
  purple: '#9933cc',
  variable: '#32d1df',
  orange: '#eb7b18',
  orangeDark: '#ff780a',
};

const backgrounds = {
  bg1: v2.palette.layer1,
  bg2: v2.palette.layer2,
  bg3: v2.palette.action.hover,
  dashboardBg: v2.palette.layer0,
  bgBlue1: v2.palette.primary.main,
  bgBlue2: v2.palette.primary.shade,
};

const borders = {
  border1: v2.palette.border0,
  border2: v2.palette.border1,
  border3: v2.palette.border2,
};

const textColors = {
  textStrong: v2.palette.text.maxContrast,
  textHeading: v2.palette.text.primary,
  text: v2.palette.text.primary,
  textSemiWeak: v2.palette.text.secondary,
  textWeak: v2.palette.text.secondary,
  textFaint: v2.palette.text.disabled,
  textBlue: v2.palette.primary.text,
};

const form = {
  // Next-gen forms functional colors
  formLabel: v2.palette.text.primary,
  formDescription: v2.palette.text.secondary,
  formInputBg: basicColors.gray05,
  formInputBgDisabled: basicColors.gray10,
  formInputBorder: borders.border2,
  formInputBorderHover: basicColors.gray33,
  formInputBorderActive: basicColors.blue95,
  formInputBorderInvalid: basicColors.red88,
  formInputPlaceholderText: textColors.textFaint,
  formInputText: basicColors.gray85,
  formInputDisabledText: basicColors.gray70,
  formFocusOutline: basicColors.blue77,
  formValidationMessageText: basicColors.white,
  formValidationMessageBg: basicColors.red88,
  formSwitchBg: basicColors.gray25,
  formSwitchBgActive: basicColors.blue95,
  formSwitchBgHover: basicColors.gray33,
  formSwitchBgActiveHover: basicColors.blue80,
  formSwitchBgDisabled: basicColors.gray25,
  formSwitchDot: basicColors.gray15,
  formCheckboxBgChecked: basicColors.blue95,
  formCheckboxBgCheckedHover: basicColors.blue80,
  formCheckboxCheckmark: basicColors.gray25,
};

const darkTheme: GrafanaTheme = {
  ...defaultTheme,
  type: GrafanaThemeType.Dark,
  isDark: true,
  isLight: false,
  name: 'Grafana Dark',
  palette: {
    ...basicColors,
    brandPrimary: basicColors.orange,
    brandSuccess: basicColors.greenBase,
    brandWarning: basicColors.orange,
    brandDanger: basicColors.redBase,
    queryRed: basicColors.redBase,
    queryGreen: '#74e680',
    queryPurple: '#fe85fc',
    queryOrange: basicColors.orange,
    online: basicColors.greenBase,
    warn: '#f79520',
    critical: basicColors.redBase,
  },
  colors: {
    ...backgrounds,
    ...borders,
    ...form,
    ...textColors,

    bodyBg: backgrounds.bg1,
    panelBg: backgrounds.bg1,
    pageHeaderBg: backgrounds.bg2,
    pageHeaderBorder: borders.border1,
    panelBorder: borders.border1,

    dropdownBg: form.formInputBg,
    dropdownShadow: basicColors.black,
    dropdownOptionHoverBg: backgrounds.bg2,

    link: basicColors.gray4,
    linkDisabled: basicColors.gray2,
    linkHover: basicColors.white,
    linkExternal: basicColors.blue85,
  },
  shadows: {
    listItem: 'none',
  },
  v2: v2,
};

export default darkTheme;
