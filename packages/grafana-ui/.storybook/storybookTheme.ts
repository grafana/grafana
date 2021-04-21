import { GrafanaThemeV2, createTheme } from '@grafana/data';
//@ts-ignore
import { create } from '@storybook/theming/create';
import '../src/components/Icon/iconBundle';

const createStorybookTheme = (theme: GrafanaThemeV2) => {
  return create({
    base: theme.name.includes('Light') ? 'light' : 'dark',

    colorPrimary: theme.colors.primary.main,
    colorSecondary: theme.colors.error.main,

    // UI
    appBg: theme.colors.background.canvas,
    appContentBg: theme.colors.background.primary,
    appBorderColor: theme.colors.border.medium,
    appBorderRadius: theme.shape.borderRadius(1),

    // Typography
    fontBase: theme.typography.fontFamily,
    fontCode: theme.typography.fontFamilyMonospace,

    // Text colors
    textColor: theme.colors.primary.text,
    textInverseColor: theme.colors.primary.contrastText,

    // Toolbar default and active colors
    barTextColor: theme.colors.text.primary,
    barSelectedColor: theme.colors.emphasize(theme.colors.primary.text),
    barBg: theme.colors.background.primary,

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

const GrafanaLight = createStorybookTheme(createTheme({ colors: { mode: 'light' } }));
const GrafanaDark = createStorybookTheme(createTheme({ colors: { mode: 'dark' } }));

export { GrafanaLight, GrafanaDark };
