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

/** Modern Muted v2 — soft professional tones */
const MODERN_MUTED_V2: PaletteDefinition = {
  id: 'palette-modern-muted-v2',
  name: 'Modern Muted v2',
  colors: ['#5c83b4', '#c88b64', '#6ba07d', '#b47996', '#4a9ea6', '#c0aa5e', '#8677bb', '#c46e6e'],
};

/** New Editor — golden-ratio hue distribution */
const NEW_EDITOR: PaletteDefinition = {
  id: 'palette-new-editor',
  name: 'New Editor',
  colors: ['#6191c2', '#c47384', '#53c15c', '#8c6ebf', '#c7a157', '#78c9c6', '#c157a7', '#96c270'],
};

/** All custom palettes shown in the Tab editor picker (Classic is added by the UI from theme). */
export const CUSTOM_PALETTES: PaletteDefinition[] = [
  AI_ZEITGEIST_V2,
  VIVID_SPECTRUM,
  CLASSIC_MODERNIZED,
  MODERN_MUTED_V2,
  NEW_EDITOR,
];
