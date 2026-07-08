/**
 * A "recipe" is a compact, easy-to-generate description of a dashboard that we
 * then compose into a strict `DashboardV2Spec`. The LLM writes the recipe; the
 * composer (below) does the schema-heavy lifting.
 *
 * Why go through a recipe instead of having the LLM emit V2 JSON directly:
 * - The V2 schema is dense (kinds-within-kinds, `PanelQuery` wrapping `DataQuery`,
 *   `VizConfig` per panel type, grid-item wrappers with x/y/width/height, ...).
 *   LLMs get bits of it wrong in ~every attempt when asked to produce it end-to-end.
 * - We want deterministic panel positioning; the composer runs a real 24-column
 *   grid packer so we don't ship overlapping tiles.
 * - We want to add / change panel-type defaults over time without re-prompting.
 * - The recipe is small enough to fit comfortably in a system prompt example,
 *   which makes the LLM output much more consistent.
 */

/** Supported panel visualisations. Anything else the LLM asks for falls back to `timeseries`. */
export type RecipePanelType = 'timeseries' | 'stat' | 'gauge' | 'bargauge' | 'table' | 'piechart' | 'heatmap' | 'logs';

/**
 * Colour tokens the LLM is allowed to reference on thresholds. Grafana accepts many
 * more, but we keep the surface tiny so validation is trivial.
 */
export type RecipeThresholdColor = 'green' | 'yellow' | 'orange' | 'red' | 'blue' | 'purple';

/** Legend display for panels that have one. `hidden` skips the legend entirely. */
export type RecipeLegend = 'hidden' | 'list' | 'table';

/** Predefined column spans against a 24-column grid. */
export type RecipePanelSpan = 6 | 8 | 12 | 16 | 18 | 24;

export interface RecipeQuery {
  /** UID of the datasource this query runs against. Must be one the recipe author has access to. */
  datasourceUid: string;
  /** PromQL / LogQL / native query for the datasource. Not sanitised — treated as opaque. */
  expr: string;
  /** Legend template, e.g. `{{service}}`. Optional; falls back to Grafana's default. */
  legendFormat?: string;
  /** Ref id for the query. Composer assigns A/B/C… if missing. */
  refId?: string;
  /** `true` for instant queries (single value at range end); otherwise range queries. */
  instant?: boolean;
  /** Explicit result format; usually inferred from panel type. */
  format?: 'time_series' | 'table' | 'heatmap';
}

export interface RecipeThreshold {
  /** Threshold value. `null` marks the base step (must be exactly one, first). */
  value: number | null;
  color: RecipeThresholdColor;
}

export interface RecipePanel {
  title: string;
  description?: string;
  type: RecipePanelType;
  queries: RecipeQuery[];
  /** Column span in the 24-col grid; defaults per panel type when omitted. */
  span?: RecipePanelSpan;
  /** Row height in grid units; defaults per panel type when omitted. */
  height?: number;
  unit?: string;
  min?: number;
  max?: number;
  decimals?: number;
  thresholds?: RecipeThreshold[];
  legend?: RecipeLegend;
  /** Stack area / bar values (timeseries / bargauge only). */
  stacking?: boolean;
}

export interface RecipeVariable {
  /** Variable name — becomes `$name` in queries. Must be a valid identifier. */
  name: string;
  /** Human-friendly display label. Falls back to `name`. */
  label?: string;
  /** Prometheus / Loki label key to enumerate values from. */
  labelKey: string;
  /** UID of the datasource to run the label query against. */
  datasourceUid: string;
  /** Allow multi-value selection. Defaults to `true`. */
  multi?: boolean;
  /** Include an "All" option. Defaults to `true` when `multi` is on. */
  includeAll?: boolean;
  /** Regex applied to returned values. */
  regex?: string;
  /** Sort order for the picker. Defaults to `alphabeticalAsc`. */
  sort?: 'disabled' | 'alphabeticalAsc' | 'alphabeticalDesc' | 'numericalAsc' | 'numericalDesc';
}

/**
 * Presentation style for a dashboard section:
 * - `tab`: rendered as a `TabsLayout` where each section becomes an addressable tab.
 *   Use when the sections describe *independent* concerns the user picks one of
 *   (e.g. Overview / Errors / Latency / Saturation for a service).
 * - `row`: rendered as a `RowsLayout` where each section becomes a labelled row
 *   the user can collapse. Use when the sections are *complementary* and users
 *   scroll through them (e.g. Control plane / Nodes / Namespaces / Workloads for
 *   a Kubernetes cluster overview).
 *
 * When a recipe mixes both, the composer falls back to rows and nests any tab-only
 * sections inside a `TabsLayout` row so the user still sees the intent.
 */
export type RecipeSectionKind = 'tab' | 'row';

/**
 * Inner layout used to arrange the panels *inside* a section.
 * - `grid`: 24-column fixed grid using the same next-fit packer as the flat
 *   top-level layout. Best for dashboards with clear "hero" panels and
 *   heterogeneous panel sizes.
 * - `auto`: `AutoGridLayout` — responsive, uniform tiles. Best for grids of
 *   stats/gauges/small timeseries where every panel is roughly the same shape.
 */
export type RecipeInnerLayout = 'grid' | 'auto';

/**
 * A row of panels living *inside* a section. This is the deepest layout level:
 * a labelled, optionally-collapsible band that arranges its panels in a grid or
 * a uniform auto-grid. Rows are what turn a tab from a flat wall of tiles into a
 * scannable "Overview → Errors → Latency → …" stack.
 */
export interface RecipeRow {
  /** Row header (e.g. "Overview", "Errors"). Collapsed rows without a title are hard to reopen. */
  title: string;
  /** Panels inside the row, positioned via `layout`. */
  panels: RecipePanel[];
  /** Inner layout hint. Defaults to auto-detection (auto for uniform stat/gauge strips, grid otherwise). */
  layout?: RecipeInnerLayout;
  /** Start collapsed? Defaults to `false`. */
  collapsed?: boolean;
  /** For `auto` layouts: cap on tiles per responsive row. Defaults to `3`. */
  autoColumns?: number;
}

/**
 * A recipe section groups panels under a common label. Sections turn a flat list
 * of tiles into an actual layout tree — tabs at the top level, rows next to each
 * other, and each section carrying either its own inner grid of panels or a set
 * of nested {@link RecipeRow}s.
 *
 * A section holds EITHER `rows` (preferred for tabs — gives a tab an internal
 * "Overview / detail" structure) OR a flat `panels` list. When both are present,
 * `rows` wins.
 */
export interface RecipeSection {
  /** Tab / row title. Required for tabs; recommended for rows (collapsed rows without a title are hard to reopen). */
  title: string;
  /** How the section is presented — see {@link RecipeSectionKind}. */
  kind: RecipeSectionKind;
  /**
   * Nested rows. When set (and non-empty) the section renders as a stack of
   * labelled rows and `panels` is ignored. Primarily used to give a tab an
   * internal row structure (tab → rows → panels), which the V2 schema allows.
   */
  rows?: RecipeRow[];
  /** Panels inside the section, positioned via `layout`. Used when `rows` is absent. */
  panels?: RecipePanel[];
  /** Inner layout hint for the flat `panels` path. Defaults to auto-detection. */
  layout?: RecipeInnerLayout;
  /** For `row` sections: start collapsed? Defaults to `false`. Ignored for tabs. */
  collapsed?: boolean;
  /**
   * For `auto` inner layouts: cap on tiles per responsive row. Ignored for
   * `grid` layouts. Defaults to `3`, which suits most stat/gauge grids.
   */
  autoColumns?: number;
}

export interface DashboardRecipe {
  title: string;
  description?: string;
  tags?: string[];
  variables?: RecipeVariable[];
  /**
   * Grouped panels. Prefer this over the flat `panels` list whenever the
   * dashboard has multiple concerns worth separating. When set (and non-empty),
   * the composer produces the corresponding TabsLayout / RowsLayout tree and
   * `panels` is ignored.
   */
  sections?: RecipeSection[];
  /**
   * Fallback: a flat list of panels rendered as a single 24-column GridLayout.
   * Preserved for backwards compatibility with recipes that don't need layout
   * structure. Ignored when `sections` is present and non-empty.
   */
  panels?: RecipePanel[];
}
