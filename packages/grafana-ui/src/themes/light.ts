import defaultTheme, { commonColorsPalette } from './default';
import { GrafanaThemeType, GrafanaTheme } from '@grafana/data';

const basicColors = {
  ...commonColorsPalette,
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
  gray1: '#52545c',
  gray2: '#767980',
  gray3: '#acb6bf',
  gray4: '#c7d0d9',
  gray5: '#dde4ed',
  gray6: '#e9edf2', // same as gray95
  gray7: '#f7f8fa', // same as gray98
  redBase: '#e02f44',
  redShade: '#c4162a',
  greenBase: '#3eb15b',
  greenShade: '#369b4f',
  red: '#d44939',
  yellow: '#ff851b',
  purple: '#9954bb',
  orange: '#ff7941',
  orangeDark: '#ed5700',
};

const backgrounds = {
  bg1: basicColors.white,
  bg2: basicColors.gray97,
  bg3: basicColors.gray90,
  dashboardBg: basicColors.gray98,
  bgBlue1: basicColors.blue80,
  bgBlue2: basicColors.blue77,
};

const borders = {
  border1: basicColors.gray90,
  border2: basicColors.gray85,
  border3: basicColors.gray70,
};

const textColors = {
  // Text colors
  textStrong: basicColors.gray15,
  text: basicColors.gray33,
  textSemiWeak: basicColors.gray33,
  textWeak: basicColors.gray60,
  textFaint: basicColors.gray70,
  textBlue: basicColors.blue85,
};

const form = {
  formLabel: textColors.text,
  formDescription: textColors.textWeak,
  formLegend: basicColors.gray25,
  formInputBg: basicColors.white,
  formInputBgDisabled: basicColors.gray95,
  formInputBorder: basicColors.gray85,
  formInputBorderHover: basicColors.gray70,
  formInputBorderActive: basicColors.blue77,
  formInputBorderInvalid: basicColors.red88,
  formInputText: textColors.text,
  formInputPlaceholderText: textColors.textFaint,
  formInputDisabledText: textColors.textWeak,
  formFocusOutline: basicColors.blue95,
  formValidationMessageText: basicColors.white,
  formValidationMessageBg: basicColors.red88,
  formSwitchBg: basicColors.gray85,
  formSwitchBgActive: basicColors.blue77,
  formSwitchBgHover: basicColors.gray3,
  formSwitchBgActiveHover: basicColors.blue80,
  formSwitchBgDisabled: basicColors.gray4,
  formSwitchDot: basicColors.white,
  formCheckboxBgChecked: basicColors.blue77,
  formCheckboxBgCheckedHover: basicColors.blue80,
  formCheckboxCheckmark: basicColors.white,
};

const lightTheme: GrafanaTheme = {
  ...defaultTheme,
  type: GrafanaThemeType.Light,
  isDark: false,
  isLight: true,
  name: 'Grafana Light',
  palette: {
    ...basicColors,
    brandPrimary: basicColors.orange,
    brandSuccess: basicColors.greenBase,
    brandWarning: basicColors.orange,
    brandDanger: basicColors.redBase,
    queryRed: basicColors.redBase,
    queryGreen: basicColors.greenBase,
    queryPurple: basicColors.purple,
    queryOrange: basicColors.orange,
    online: basicColors.greenShade,
    warn: '#f79520',
    critical: basicColors.redShade,
  },
  colors: {
    ...backgrounds,
    ...borders,
    ...textColors,
    ...form,

    bodyBg: backgrounds.bg1,
    panelBg: backgrounds.bg1,
    pageHeaderBg: backgrounds.bg2,
    pageHeaderBorder: borders.border1,
    panelBorder: borders.border1,

    dropdownBg: form.formInputBg,
    dropdownShadow: basicColors.gray3,
    dropdownOptionHoverBg: backgrounds.bg2,

    // Link colors
    link: textColors.text,
    linkDisabled: textColors.textWeak,
    linkHover: textColors.textStrong,
    linkExternal: basicColors.blue85,
    textHeading: basicColors.gray25,
  },
  shadows: {
    listItem: 'none',
  },
};

export default lightTheme;
