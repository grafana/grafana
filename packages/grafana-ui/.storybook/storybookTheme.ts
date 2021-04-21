import { GrafanaThemeV2, createTheme } from '@grafana/data';
//@ts-ignore
import { create } from '@storybook/theming/create';
import '../src/components/Icon/iconBundle';

const createStorybookTheme = (theme: GrafanaThemeV2) => {
  return create({
    base: theme.name.includes('Light') ? 'light' : 'dark',

    colorPrimary: theme.palette.primary.main,
    colorSecondary: theme.palette.error.main,

    // UI
    appBg: theme.palette.background.canvas,
    appContentBg: theme.palette.background.primary,
    appBorderColor: theme.palette.border.medium,
    appBorderRadius: theme.shape.borderRadius(1),

    // Typography
    fontBase: theme.typography.fontFamily,
    fontCode: theme.typography.fontFamilyMonospace,

    // Text colors
    textColor: theme.palette.primary.text,
    textInverseColor: theme.palette.primary.contrastText,

    // Toolbar default and active colors
    barTextColor: theme.palette.text.primary,
    barSelectedColor: theme.palette.emphasize(theme.palette.primary.text),
    barBg: theme.palette.background.primary,

    // Form colors
    inputBg: theme.components.input.background,
    inputBorder: theme.components.input.border,
    inputTextColor: theme.components.input.text,
    inputBorderRadius: theme.shape.borderRadius(1),

    brandTitle: 'Grafana UI',
    brandUrl: './',
    brandImage: 'public/img/grafana_icon.svg',
  });
};

const GrafanaLight = createStorybookTheme(createTheme({ palette: { mode: 'light' } }));
const GrafanaDark = createStorybookTheme(createTheme({ palette: { mode: 'dark' } }));

export { GrafanaLight, GrafanaDark };
