import { config } from '@grafana/runtime';

const USER_THEME_LABEL = 'grafana.app/user-id';

/** Build the full API resource name for a user theme: "{userUID}.{bareThemeName}" */
export function getUserThemeResourceName(bareThemeName: string): string {
  return `${config.bootData.user.uid}.${bareThemeName}`;
}

/** Strip the user ID prefix from a full resource name to get the bare theme name */
export function stripUserThemePrefix(fullName: string): string {
  const dotIndex = fullName.indexOf('.');
  return dotIndex >= 0 ? fullName.substring(dotIndex + 1) : fullName;
}

/** Check if a theme is a user theme by checking for the user label */
export function isUserTheme(labels?: Record<string, string>): boolean {
  return Boolean(labels?.[USER_THEME_LABEL]);
}

/** Build the labels object for a user theme */
export function getUserThemeLabels(): Record<string, string> {
  return { [USER_THEME_LABEL]: config.bootData.user.uid };
}
