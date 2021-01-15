import { GrafanaTheme, GrafanaThemeType } from '../../types/theme';

export function getTestTheme(type: GrafanaThemeType = GrafanaThemeType.Dark): GrafanaTheme {
  return ({
    type,
    isDark: type === GrafanaThemeType.Dark,
    isLight: type === GrafanaThemeType.Light,
    colors: {
      panelBg: 'white',
    },
  } as unknown) as GrafanaTheme;
}
