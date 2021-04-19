//@ts-ignore
import { create } from '@storybook/theming/create';
import lightTheme from '../src/themes/light';
import darkTheme from '../src/themes/dark';
import { GrafanaTheme } from '@grafana/data';
import '../src/components/Icon/iconBundle';

const createTheme = (theme: GrafanaTheme) => {
  return create({
    base: theme.name.includes('Light') ? 'light' : 'dark',

    colorPrimary: theme.v2.palette.primary.main,
    colorSecondary: theme.v2.palette.error.main,

    // UI
    appBg: theme.v2.palette.background.canvas,
    appContentBg: theme.v2.palette.background.primary,
    appBorderColor: theme.v2.palette.border.medium,
    appBorderRadius: theme.v2.shape.borderRadius(1),

    // Typography
    fontBase: theme.v2.typography.fontFamily,
    fontCode: theme.v2.typography.fontFamilyMonospace,

    // Text colors
    textColor: theme.v2.palette.primary.text,
    textInverseColor: theme.v2.palette.primary.contrastText,

    // Toolbar default and active colors
    barTextColor: theme.v2.palette.text.primary,
    barSelectedColor: theme.v2.palette.emphasize(theme.v2.palette.primary.text),
    barBg: theme.v2.palette.background.primary,

    // Form colors
    inputBg: theme.v2.components.input.background,
    inputBorder: theme.v2.components.input.border,
    inputTextColor: theme.v2.components.input.text,
    inputBorderRadius: theme.v2.shape.borderRadius(1),

    brandTitle: 'Grafana UI',
    brandUrl: './',
    brandImage: 'public/img/grafana_icon.svg',
  });
};

const GrafanaLight = createTheme(lightTheme);
const GrafanaDark = createTheme(darkTheme);

export { GrafanaLight, GrafanaDark };
