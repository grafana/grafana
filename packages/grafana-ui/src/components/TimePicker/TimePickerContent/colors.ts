import { GrafanaTheme } from '@grafana/data';
import { selectThemeVariant } from '../../../themes/selectThemeVariant';

export const getThemeColors = (theme: GrafanaTheme) => {
  return {
    border: selectThemeVariant(
      {
        light: theme.palette.gray4,
        dark: theme.palette.gray25,
      },
      theme.type
    ),
    background: selectThemeVariant(
      {
        dark: theme.palette.dark2,
        light: theme.background.dropdown,
      },
      theme.type
    ),
    shadow: selectThemeVariant(
      {
        light: theme.palette.gray85,
        dark: theme.palette.black,
      },
      theme.type
    ),
    formBackground: selectThemeVariant(
      {
        dark: theme.palette.gray15,
        light: theme.palette.gray98,
      },
      theme.type
    ),
  };
};
