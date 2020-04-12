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
    background: theme.colors.dropdownBg,
    shadow: theme.colors.dropdownShadow,
    formBackground: selectThemeVariant(
      {
        dark: theme.palette.gray15,
        light: theme.palette.gray98,
      },
      theme.type
    ),
  };
};
