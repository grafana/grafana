import defaultTheme, { commonColorsPalette } from './default';
import { GrafanaThemeType, GrafanaTheme, createTheme } from '@grafana/data';

const v2 = createTheme({ palette: { mode: 'light' } });

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
  bg1: v2.palette.background.primary,
  bg2: v2.palette.background.secondary,
  bg3: v2.palette.action.hover,
  dashboardBg: v2.palette.background.canvas,
  bgBlue1: basicColors.blue80,
  bgBlue2: basicColors.blue77,
};

const borders = {
  border1: v2.palette.border.weak,
  border2: v2.palette.border.medium,
  border3: v2.palette.border.strong,
};

const textColors = {
  // Text colors
  textStrong: v2.palette.text.maxContrast,
  text: v2.palette.text.primary,
  textSemiWeak: v2.palette.text.secondary,
  textWeak: v2.palette.text.secondary,
  textFaint: v2.palette.text.disabled,
  textBlue: v2.palette.primary.text,
};

const form = {
  formLabel: textColors.text,
  formDescription: v2.palette.text.secondary,
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

    bodyBg: v2.palette.background.canvas,
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
    textHeading: v2.palette.text.primary,
  },
  shadows: {
    listItem: 'none',
  },
  v2: v2,
};

export default lightTheme;
