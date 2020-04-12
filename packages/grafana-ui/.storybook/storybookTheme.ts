//@ts-ignore
import { create } from '@storybook/theming/create';
import lightTheme from '../src/themes/light';
import darkTheme from '../src/themes/dark';
import ThemeCommons from '../src/themes/default';
import { GrafanaTheme } from '@grafana/data';

const createTheme = (theme: GrafanaTheme) => {
  return create({
    base: theme.name.includes('Light') ? 'light' : 'dark',

    colorPrimary: theme.palette.brandPrimary,
    colorSecondary: theme.palette.brandPrimary,

    // UI
    appBg: theme.palette.pageBg,
    appContentBg: theme.palette.pageBg,
    appBorderColor: theme.palette.pageHeaderBorder,
    appBorderRadius: 4,

    // Typography
    fontBase: ThemeCommons.typography.fontFamily.sansSerif,
    fontCode: ThemeCommons.typography.fontFamily.monospace,

    // Text colors
    textColor: theme.palette.text,
    textInverseColor: 'rgba(255,255,255,0.9)',

    // Toolbar default and active colors
    barTextColor: theme.palette.formInputBorderActive,
    barSelectedColor: theme.palette.brandPrimary,
    barBg: theme.palette.pageBg,

    // Form colors
    inputBg: theme.palette.formInputBg,
    inputBorder: theme.palette.formInputBorder,
    inputTextColor: theme.palette.formInputText,
    inputBorderRadius: 4,

    brandTitle: 'Grafana UI',
    brandUrl: './',
    brandImage: './grafana_icon.svg',
  });
};

const GrafanaLight = createTheme(lightTheme);
const GrafanaDark = createTheme(darkTheme);

export { GrafanaLight, GrafanaDark };
