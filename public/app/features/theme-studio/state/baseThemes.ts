import { type NewThemeOptions } from '@grafana/data';
import { NewThemeOptionsSchema } from '@grafana/data/internal';
import aubergine from '@grafana/data/themes/definitions/aubergine.json';
import desertbloom from '@grafana/data/themes/definitions/desertbloom.json';
import deut_prot_dark from '@grafana/data/themes/definitions/deut_prot_dark.json';
import deut_prot_light from '@grafana/data/themes/definitions/deut_prot_light.json';
import gildedgrove from '@grafana/data/themes/definitions/gildedgrove.json';
import gloom from '@grafana/data/themes/definitions/gloom.json';
import mars from '@grafana/data/themes/definitions/mars.json';
import matrix from '@grafana/data/themes/definitions/matrix.json';
import sapphiredusk from '@grafana/data/themes/definitions/sapphiredusk.json';
import synthwave from '@grafana/data/themes/definitions/synthwave.json';
import tritanopia_dark from '@grafana/data/themes/definitions/tritanopia_dark.json';
import tritanopia_light from '@grafana/data/themes/definitions/tritanopia_light.json';
import tron from '@grafana/data/themes/definitions/tron.json';
import victorian from '@grafana/data/themes/definitions/victorian.json';
import visual_refresh_dark from '@grafana/data/themes/definitions/visual_refresh_dark.json';
import visual_refresh_light from '@grafana/data/themes/definitions/visual_refresh_light.json';
import zen from '@grafana/data/themes/definitions/zen.json';
import { type ComboboxOption } from '@grafana/ui';

/** Built-in themes expressed as the minimal NewThemeOptions the studio edits. */
const builtInThemes: Record<string, NewThemeOptions> = {
  dark: { name: 'Dark', id: 'dark', colors: { mode: 'dark' } },
  light: { name: 'Light', id: 'light', colors: { mode: 'light' } },
};

const experimentalDefinitions: Record<string, unknown> = {
  aubergine,
  desertbloom,
  deut_prot_dark,
  deut_prot_light,
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
  visual_refresh_dark,
  visual_refresh_light,
  zen,
};

/** Map of base theme id -> NewThemeOptions that can be loaded into the studio. */
export const baseThemeMap: Record<string, NewThemeOptions> = { ...builtInThemes };

for (const [name, json] of Object.entries(experimentalDefinitions)) {
  const result = NewThemeOptionsSchema.safeParse(json);
  if (!result.success) {
    console.error(`Invalid theme definition for theme ${name}: ${result.error.message}`);
  } else {
    baseThemeMap[result.data.id] = result.data;
  }
}

export const baseThemeOptions: Array<ComboboxOption<string>> = Object.entries(baseThemeMap).map(([value, theme]) => ({
  value,
  label: theme.name,
}));
