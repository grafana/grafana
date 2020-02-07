//@ts-ignore
import { create } from '@storybook/theming/create';
import lightTheme from '../src/themes/light';
import darkTheme from '../src/themes/dark';
import ThemeCommons from '../src/themes/default';

//Use this to toggle between light and dark
const theme = lightTheme || darkTheme;

export default create({
  base: theme.name.includes('Light') ? 'light' : 'dark',

  colorPrimary: theme.colors.brandPrimary,
  colorSecondary: theme.colors.brandPrimary,

  // UI
  appBg: theme.colors.bodyBg,
  appContentBg: theme.colors.bodyBg,
  appBorderColor: theme.colors.pageHeaderBorder,
  appBorderRadius: 4,

  // Typography
  fontBase: ThemeCommons.typography.fontFamily.sansSerif,
  fontCode: ThemeCommons.typography.fontFamily.monospace,

  // Text colors
  textColor: theme.colors.text,
  textInverseColor: 'rgba(255,255,255,0.9)',

  // Toolbar default and active colors
  barTextColor: theme.colors.formInputBorderActive,
  barSelectedColor: theme.colors.brandPrimary,
  barBg: theme.colors.bodyBg,

  // Form colors
  inputBg: theme.colors.formInputBg,
  inputBorder: theme.colors.formInputBorder,
  inputTextColor: theme.colors.formInputText,
  inputBorderRadius: 4,

  brandTitle: 'Grafana UI',
  brandUrl: '/',
  brandImage: '/grafana_icon.svg',
});
