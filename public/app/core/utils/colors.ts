import config from 'app/core/config';

export function getThemeColor(dark: string, light: string): string {
  return config.theme2.isLight ? light : dark;
}
