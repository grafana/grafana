// ---------------------------------------------------------------------------
// Palette definitions — hex colors used for rendering the picker swatches.
// Full palettes are registered in packages/grafana-data/src/field/fieldColor.ts
// via FieldColorSchemeMode. The IDs here must match FieldColorModeId values.
// ---------------------------------------------------------------------------

export interface PaletteDefinition {
  id: string;
  name: string;
  colors: string[];
}

export const CLASSIC_PALETTE_ID = 'palette-classic';

/** AI Zeitgeist v2 — muted/earthy tones */
const AI_ZEITGEIST_V2: PaletteDefinition = {
  id: 'palette-ai-zeitgeist-v2',
  name: 'AI Zeitgeist v2',
  colors: ['#1b9e86', '#ab6297', '#b09053', '#49709c', '#c95f5f', '#5e8c68', '#8771ab', '#cc7a43'],
};

/** Vivid Spectrum — saturated / high-contrast */
const VIVID_SPECTRUM: PaletteDefinition = {
  id: 'palette-vivid-spectrum',
  name: 'Vivid Spectrum',
  colors: ['#3a8ec5', '#d4703a', '#2aaa7a', '#c74a7a', '#7a68c8', '#a8b030', '#d05858', '#2a98a8'],
};

/** Classic Modernized — updated classic hues */
const CLASSIC_MODERNIZED: PaletteDefinition = {
  id: 'palette-classic-modernized',
  name: 'Classic Modernized',
  colors: ['#4da87a', '#c49838', '#3e9fb0', '#cc7040', '#c45858', '#3578be', '#a050a0', '#7060b0'],
};


/** Modern Slate — 50-color muted/professional palette, lower saturation, light-mode friendly */
const MODERN_SLATE: PaletteDefinition = {
  id: 'palette-modern-slate',
  name: 'Modern Slate',
  colors: ['#518AC2', '#CE7386', '#60C769', '#7C51C2', '#CEB073', '#60C7C3', '#C251A6', '#9DCE73'],
};

/** Vivid Modern — 50-color golden-angle palette, saturated, dual-background legible */
const VIVID_MODERN: PaletteDefinition = {
  id: 'palette-vivid-modern',
  name: 'Vivid Modern',
  colors: ['#1F7DDB', '#E33B5E', '#29E038', '#661FDB', '#E3AB3B', '#29E0D9', '#D425A9', '#88E33B'],
};

/** All custom palettes shown in the Tab editor picker (Classic is added by the UI from theme). */
export const CUSTOM_PALETTES: PaletteDefinition[] = [
  AI_ZEITGEIST_V2,
  VIVID_SPECTRUM,
  CLASSIC_MODERNIZED,
  MODERN_SLATE,
  VIVID_MODERN,
];
