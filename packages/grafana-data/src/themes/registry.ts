import { Registry, RegistryItem } from '../utils/Registry';

import { createTheme } from './createTheme';
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
export function getBuiltInThemes(includeExtras?: boolean) {
  return themeRegistry.list().filter((item) => {
    return includeExtras ? true : !item.isExtra;
  });
}

/**
 * There is also a backend list at services/perferences/themes.go
 */
const themeRegistry = new Registry<ThemeRegistryItem>(() => {
  return [
    { id: 'system', name: 'System preference', build: getSystemPreferenceTheme },
    { id: 'dark', name: 'Dark', build: () => createTheme({ colors: { mode: 'dark' } }) },
    { id: 'light', name: 'Light', build: () => createTheme({ colors: { mode: 'light' } }) },
    { id: 'blue-night', name: 'Blue night', build: createBlueNight, isExtra: true },
    { id: 'midnight', name: 'Midnight', build: createMidnight, isExtra: true },
  ];
});

function getSystemPreferenceTheme() {
  const mediaResult = window.matchMedia('(prefers-color-scheme: dark)');
  const id = mediaResult.matches ? 'dark' : 'light';
  return getThemeById(id);
}

/**
 * Just a temporary placeholder for a possible new theme
 */
function createMidnight(): GrafanaTheme2 {
  const whiteBase = '204, 204, 220';

  return createTheme({
    name: 'Midnight',
    colors: {
      mode: 'dark',
      background: {
        canvas: '#000000',
        primary: '#000000',
        secondary: '#181818',
      },
      border: {
        weak: `rgba(${whiteBase}, 0.17)`,
        medium: `rgba(${whiteBase}, 0.25)`,
        strong: `rgba(${whiteBase}, 0.35)`,
      },
    },
  });
}

/**
 * Just a temporary placeholder for a possible new theme
 */
function createBlueNight(): GrafanaTheme2 {
  return createTheme({
    name: 'Blue night',
    colors: {
      mode: 'dark',
      background: {
        canvas: '#15161d',
        primary: '#15161d',
        secondary: '#1d1f2e',
      },
      border: {
        weak: `#2e304f`,
        medium: `#2e304f`,
        strong: `#2e304f`,
      },
    },
  });
}
