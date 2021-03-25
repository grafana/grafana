export interface GrafanaTheme {
  name: string;
  mode: 'light' | 'dark';
  isDark: boolean;
  isLight: boolean;
  colors: ThemeColors;
}

export interface NewThemeProps {
  name: string;
  mode: 'light' | 'dark';
  colors: ThemeColors;
}

export function createTheme(props: NewThemeProps): GrafanaTheme {}
