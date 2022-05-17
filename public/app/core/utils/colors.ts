import config from 'app/core/config';

export function getThemeColor(dark: string, light: string): string {
  return config.bootData.user.lightTheme || config.bootData.user.fusebitTheme ? light : dark;
}
