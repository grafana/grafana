/** What a dashboard saves: the pack and any of its options the author picked. */
export interface DashboardStyleChoice {
  pack: string;
  palette?: string;
  accent?: string;
  typography?: string;
}

/** Colours for one lighting mode of a palette. */
export interface StyleColors {
  bg: string;
  surface: string;
  ink: string;
  muted: string;
  line: string;
  accent: string;
  good: string;
  warn: string;
  bad: string;
  /** Categorical series colours, in order. */
  series: string[];
}

export interface StylePalette {
  id: string;
  name: string;
  note: string;
  /** Follow the viewer's Grafana theme colours instead of the values below. */
  host?: boolean;
  dark: StyleColors;
  light: StyleColors;
}

export interface StyleAccent {
  id: string;
  name: string;
  dark: string;
  light: string;
}

export interface StyleTypography {
  id: string;
  name: string;
  display: string;
  body: string;
  mono: string;
  /** Face used for large figures. */
  figure: 'display' | 'body';
  figureWeight: number;
  headingWeight: number;
  headingTracking: string;
}

/**
 * Structural treatments are fixed per pack: they are the art direction. Palette, accent and
 * typography are the parts a viewer may switch.
 */
export interface StyleTreatments {
  /** Cards keep panel surfaces; open removes panel backgrounds and borders. */
  surface: 'cards' | 'open';
  /** The rule that opens a report section. */
  sectionRule: 'none' | 'hairline' | 'heavy' | 'dashed';
  sectionNumbering: 'none' | 'section' | 'roman';
  /** Prefix panel titles with "Fig. n". */
  figureNumbering: boolean;
  /** How emphasis in headings and the lede reads: italic, or set in the accent. */
  emphasis: 'italic' | 'accent';
  /** Print a source line (data source, queries, period) under each panel. */
  sourceLines: boolean;
  /** Hairline rules between side-by-side panels in open sections. */
  columnRules: 'none' | 'solid' | 'dashed';
  /** Panel titles set as small headlines in the display face. */
  headlinePanelTitles: boolean;
  /** Report section heading size in rem. */
  headingSize: number;
  /** Masthead title size in rem. */
  mastheadSize: number;
}

export interface StylePack {
  id: string;
  name: string;
  summary: string;
  treatments: StyleTreatments;
  palettes: StylePalette[];
  accents: StyleAccent[];
  typography: StyleTypography[];
  defaults: { palette: string; typography: string };
}

/** A pack with every option resolved for the current lighting mode. */
export interface ResolvedDashboardStyle {
  pack: StylePack;
  palette: StylePalette;
  accent?: StyleAccent;
  typography: StyleTypography;
  mode: 'dark' | 'light';
  colors: StyleColors;
}
