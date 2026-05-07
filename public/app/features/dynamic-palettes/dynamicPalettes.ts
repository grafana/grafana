import { type Field, fieldColorModeRegistry, type FieldColorMode, type GrafanaTheme2 } from '@grafana/data';
import { createAsyncSingletonLoader } from 'app/features/dynamic-options/createAsyncSingletonLoader';

export const DYNAMIC_PALETTES_INDEX_KEY = 'grafana.dynamicPalettes';
export const DYNAMIC_PALETTE_KEY_PREFIX = 'grafana.dynamicPalette.';

export interface DynamicPaletteMeta {
  id: string;
  name: string;
  group?: string;
}

function getStorage(): Storage | undefined {
  if (typeof window === 'undefined') {
    return undefined;
  }

  // eslint-disable-next-line @grafana/no-direct-local-storage-access
  return window.localStorage;
}

function parseArray(raw: string | null): unknown[] {
  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function getPaletteMeta(indexItem: Record<string, unknown>): DynamicPaletteMeta | undefined {
  if (!indexItem || typeof indexItem !== 'object') {
    return undefined;
  }

  const maybeMeta = indexItem;
  if (typeof maybeMeta.id !== 'string' || typeof maybeMeta.name !== 'string') {
    return undefined;
  }

  return {
    id: maybeMeta.id,
    name: maybeMeta.name,
    group: typeof maybeMeta.group === 'string' ? maybeMeta.group : undefined,
  };
}

function getPaletteColors(storage: Storage, paletteId: string): string[] {
  const rawColors = parseArray(storage.getItem(`${DYNAMIC_PALETTE_KEY_PREFIX}${paletteId}`));
  return rawColors.filter((v): v is string => typeof v === 'string');
}

function makeDynamicFieldColorMode(meta: DynamicPaletteMeta, colors: string[]): FieldColorMode {
  return {
    id: meta.id,
    name: meta.name,
    group: meta.group,
    isContinuous: false,
    isByValue: false,
    getColors: () => colors,
    getCalculator: (field: Field, theme: GrafanaTheme2) => {
      const resolvedColors = colors.map(theme.visualization.getColorByName);
      return (_value, _percent, _threshold) => {
        if (resolvedColors.length === 0) {
          return theme.visualization.getColorByName('gray');
        }
        const seriesIndex = field.state?.seriesIndex ?? 0;
        return resolvedColors[seriesIndex % resolvedColors.length];
      };
    },
  };
}

export async function fetchDynamicFieldColorModes(): Promise<FieldColorMode[]> {
  await new Promise<void>((resolve) => {
    setTimeout(resolve, 2000);
  });

  const storage = getStorage();
  if (!storage) {
    return [];
  }

  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
  const index: Array<Record<string, unknown>> = parseArray(storage.getItem(DYNAMIC_PALETTES_INDEX_KEY)) as Array<
    Record<string, unknown>
  >;

  return index
    .map(getPaletteMeta)
    .filter((meta): meta is DynamicPaletteMeta => meta !== undefined)
    .map((meta) => {
      const colors = getPaletteColors(storage, meta.id);
      if (colors.length === 0) {
        return undefined;
      }

      return makeDynamicFieldColorMode(meta, colors);
    })
    .filter((mode): mode is FieldColorMode => mode !== undefined);
}

export function registerDynamicFieldColorModes(modes: FieldColorMode[]): void {
  for (const mode of modes) {
    if (!fieldColorModeRegistry.getIfExists(mode.id)) {
      fieldColorModeRegistry.register(mode);
    }
  }
}

export const dynamicPalettesLoader = createAsyncSingletonLoader(
  fetchDynamicFieldColorModes,
  registerDynamicFieldColorModes
);

export function isDynamicPalettesLoaded(): boolean {
  return dynamicPalettesLoader.isLoaded();
}

export async function loadDynamicFieldColorModes(): Promise<FieldColorMode[]> {
  return dynamicPalettesLoader.load();
}

export function resetDynamicFieldColorModesForTests(): void {
  dynamicPalettesLoader.reset();
}
