/**
 * localStorage-backed store for team-saved palettes.
 * Uses @grafana/data store (which wraps localStorage and handles cross-tab sync)
 * and exposes a useSyncExternalStore-compatible API.
 *
 * Each palette is also registered with fieldColorModeRegistry so that panels
 * whose color.mode is set to the palette ID resolve correctly.
 *
 * The snapshot is cached so that useSyncExternalStore receives a stable reference
 * between mutations — preventing the "Maximum update depth exceeded" infinite loop.
 */

import { Field, FieldColorMode, GrafanaTheme2, fieldColorModeRegistry, store } from '@grafana/data';

import { PaletteDefinition } from '../dashboard-scene/panel-edit/palettes';

const STORAGE_KEY = 'grafana.teamPalettes';

let cachedSnapshot: PaletteDefinition[] = store.getObject<PaletteDefinition[]>(STORAGE_KEY) ?? [];

function invalidateCache(): void {
  cachedSnapshot = store.getObject<PaletteDefinition[]>(STORAGE_KEY) ?? [];
}

function registerPaletteColorMode(palette: PaletteDefinition): void {
  if (fieldColorModeRegistry.getIfExists(palette.id)) {
    return; // Already registered in this session
  }
  const colors = palette.colors;
  const mode: FieldColorMode = {
    id: palette.id,
    name: palette.name,
    isContinuous: false,
    isByValue: false,
    getColors: (_theme: GrafanaTheme2) => colors,
    getCalculator: (field: Field, theme: GrafanaTheme2) => {
      const resolvedColors = colors.map((c) => theme.visualization.getColorByName(c));
      return (_value: number, _percent: number) => {
        const seriesIndex = field.state?.seriesIndex ?? 0;
        return resolvedColors[seriesIndex % resolvedColors.length];
      };
    },
  };
  fieldColorModeRegistry.register(mode);
}

// Register all persisted palettes at module load time so panels resolve on page refresh
for (const palette of cachedSnapshot) {
  registerPaletteColorMode(palette);
}

export function getTeamPalettesSnapshot(): PaletteDefinition[] {
  return cachedSnapshot;
}

export function saveTeamPalette(palette: PaletteDefinition): void {
  const current = [...cachedSnapshot];
  const idx = current.findIndex((p) => p.id === palette.id);
  if (idx >= 0) {
    current[idx] = palette;
  } else {
    current.push(palette);
  }
  store.setObject(STORAGE_KEY, current);
  invalidateCache();
  registerPaletteColorMode(palette);
}

export function deleteTeamPalette(id: string): void {
  const current = cachedSnapshot.filter((p) => p.id !== id);
  store.setObject(STORAGE_KEY, current);
  invalidateCache();
}

/** Subscribe function for useSyncExternalStore */
export function subscribeTeamPalettes(onStoreChange: () => void): () => void {
  return store.subscribe(STORAGE_KEY, () => {
    invalidateCache();
    onStoreChange();
  });
}
