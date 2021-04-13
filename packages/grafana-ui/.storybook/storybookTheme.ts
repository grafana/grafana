//@ts-ignore
import { create } from '@storybook/theming/create';
import lightTheme from '../src/themes/light';
import darkTheme from '../src/themes/dark';
import { GrafanaTheme } from '@grafana/data';

const createTheme = (theme: GrafanaTheme) => {
  return create({
    base: theme.name.includes('Light') ? 'light' : 'dark',

    colorPrimary: theme.v2.palette.primary.main,
    colorSecondary: theme.v2.palette.error.main,

    // UI
    appBg: theme.v2.palette.layer0,
    appContentBg: theme.v2.palette.layer1,
    appBorderColor: theme.v2.palette.border1,
    appBorderRadius: theme.v2.shape.borderRadius(1),

    // Typography
    fontBase: theme.v2.typography.fontFamily,
    fontCode: theme.v2.typography.fontFamilyMonospace,

    // Text colors
    textColor: theme.v2.palette.text.primary,
    textInverseColor: theme.v2.palette.primary.contrastText,

    // Toolbar default and active colors
    barTextColor: theme.v2.palette.primary.text,
    barSelectedColor: theme.v2.palette.getHoverColor(theme.v2.palette.primary.text),
    barBg: theme.v2.palette.layer1,

    // Form colors
    inputBg: theme.v2.components.form.background,
    inputBorder: theme.v2.components.form.border,
    inputTextColor: theme.v2.components.form.text,
    inputBorderRadius: theme.v2.shape.borderRadius(1),

    brandTitle: 'Grafana UI',
    brandUrl: './',
    brandImage: 'public/img/grafana_icon.svg',
  });
};

const GrafanaLight = createTheme(lightTheme);
const GrafanaDark = createTheme(darkTheme);

export { GrafanaLight, GrafanaDark };
