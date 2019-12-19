import { GrafanaTheme } from '@grafana/data';
import { selectThemeVariant } from '../../../themes/selectThemeVariant';

export const getThemeColors = (theme: GrafanaTheme) => {
  return {
    border: selectThemeVariant(
      {
        light: theme.colors.gray4,
        dark: theme.colors.gray25,
      },
      theme.type
    ),
    background: selectThemeVariant(
      {
        dark: theme.colors.dark2,
        light: theme.background.dropdown,
      },
      theme.type
    ),
    shadow: selectThemeVariant(
      {
        light: theme.colors.gray85,
        dark: theme.colors.black,
      },
      theme.type
    ),
    formBackground: selectThemeVariant(
      {
        dark: theme.colors.gray15,
        light: theme.colors.gray98,
      },
      theme.type
    ),
  };
};
