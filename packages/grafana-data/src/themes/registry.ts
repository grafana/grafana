import { Registry, RegistryItem } from '../utils/Registry';

import { createTheme, NewThemeOptionsSchema } from './createTheme';
import aubergine from './themeDefinitions/aubergine.json';
import debug from './themeDefinitions/debug.json';
import desertbloom from './themeDefinitions/desertbloom.json';
import deuteranopia_protanopia_dark from './themeDefinitions/deuteranopia_protanopia_dark.json';
import deuteranopia_protanopia_light from './themeDefinitions/deuteranopia_protanopia_light.json';
import gildedgrove from './themeDefinitions/gildedgrove.json';
import gloom from './themeDefinitions/gloom.json';
import mars from './themeDefinitions/mars.json';
import matrix from './themeDefinitions/matrix.json';
import sapphiredusk from './themeDefinitions/sapphiredusk.json';
import synthwave from './themeDefinitions/synthwave.json';
import tritanopia_dark from './themeDefinitions/tritanopia_dark.json';
import tritanopia_light from './themeDefinitions/tritanopia_light.json';
import tron from './themeDefinitions/tron.json';
import victorian from './themeDefinitions/victorian.json';
import zen from './themeDefinitions/zen.json';
import { GrafanaTheme2 } from './types';

export interface ThemeRegistryItem extends RegistryItem {
  isExtra?: boolean;
  build: () => GrafanaTheme2;
}

const extraThemes: { [key: string]: unknown } = {
  aubergine,
  debug,
  desertbloom,
  deuteranopia_protanopia_dark,
  deuteranopia_protanopia_light,
  gildedgrove,
  gloom,
  mars,
  matrix,
  sapphiredusk,
  synthwave,
  tritanopia_dark,
  tritanopia_light,
  tron,
  victorian,
  zen,
};

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

const themeRegistry = new Registry<ThemeRegistryItem>(() => {
  return [
    { id: 'system', name: 'System preference', build: getSystemPreferenceTheme },
    { id: 'dark', name: 'Dark', build: () => createTheme({ colors: { mode: 'dark' } }) },
    { id: 'light', name: 'Light', build: () => createTheme({ colors: { mode: 'light' } }) },
  ];
});

for (const [name, json] of Object.entries(extraThemes)) {
  const result = NewThemeOptionsSchema.safeParse(json);
  if (!result.success) {
    console.error(`Invalid theme definition for theme ${name}: ${result.error.message}`);
  } else {
    const theme = result.data;
    themeRegistry.register({
      id: theme.id,
      name: theme.name,
      build: () => createTheme(theme),
      isExtra: true,
    });
  }
}

function getSystemPreferenceTheme() {
  const mediaResult = window.matchMedia('(prefers-color-scheme: dark)');
  const id = mediaResult.matches ? 'dark' : 'light';
  return getThemeById(id);
}
