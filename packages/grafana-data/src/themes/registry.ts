import { Registry, RegistryItem } from '../utils/Registry';

import { createTheme } from './createTheme';
import * as extraThemes from './themeDefinitions';
import { GrafanaTheme2 } from './types';

export interface ThemeRegistryItem extends RegistryItem {
  isExtra?: boolean;
  build: () => GrafanaTheme2;
}

/**
 * @internal
 * Only for internal use, never use this from a plugin
 **/
export function getThemeById(id: string): GrafanaTheme2 {
  const theme = themeRegistry.getIfExists(id) ?? themeRegistry.get('dark');
  return theme.build();
}

/**
 * @internal
 * For internal use only
 */
export function getBuiltInThemes(allowedExtras: string[]) {
  const themes = themeRegistry.list().filter((item) => {
    if (item.isExtra) {
      return allowedExtras.includes(item.id);
    }
    return true;
  });
  // sort themes alphabetically, but put built-in themes (default, dark, light, system) first
  const sortedThemes = themes.sort((a, b) => {
    if (a.isExtra && !b.isExtra) {
      return 1;
    } else if (!a.isExtra && b.isExtra) {
      return -1;
    } else {
      return a.name.localeCompare(b.name);
    }
  });
  return sortedThemes;
}

/**
 * There is also a backend list at pkg/services/preference/themes.go
 */
const themeRegistry = new Registry<ThemeRegistryItem>(() => {
  return [
    { id: 'system', name: 'System preference', build: getSystemPreferenceTheme },
    { id: 'dark', name: 'Dark', build: () => createTheme({ colors: { mode: 'dark' } }) },
    { id: 'light', name: 'Light', build: () => createTheme({ colors: { mode: 'light' } }) },
  ];
});

for (const [id, theme] of Object.entries(extraThemes)) {
  themeRegistry.register({
    id,
    name: theme.name ?? '',
    build: () => createTheme(theme),
    isExtra: true,
  });
}

function getSystemPreferenceTheme() {
  const mediaResult = window.matchMedia('(prefers-color-scheme: dark)');
  const id = mediaResult.matches ? 'dark' : 'light';
  return getThemeById(id);
}
