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
    barSelectedColor: theme.palette.brandPrimary,
    barBg: theme.colors.pageHeaderBg,

    // Form colors
    inputBg: theme.colors.formInputBg,
    inputBorder: theme.colors.formInputBorder,
    inputTextColor: theme.colors.formInputText,
    inputBorderRadius: 4,

    brandTitle: 'Grafana UI',
    brandUrl: './',
    brandImage: './grafana_icon.svg',
  });
};

const GrafanaLight = createTheme(lightTheme);
const GrafanaDark = createTheme(darkTheme);

export { GrafanaLight, GrafanaDark };
