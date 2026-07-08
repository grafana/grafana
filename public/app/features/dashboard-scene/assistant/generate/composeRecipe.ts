import { t } from '@grafana/i18n';
import {
  type AutoGridLayoutKind,
  type Element,
  type FieldColorModeId,
  type GridLayoutItemKind,
  type GridLayoutKind,
  type RowsLayoutKind,
  type RowsLayoutRowKind,
  type Spec as DashboardV2Spec,
  type TabsLayoutKind,
  type TabsLayoutTabKind,
  defaultSpec as defaultDashboardV2Spec,
} from '@grafana/schema/apis/dashboard.grafana.app/v2';

import {
  type DashboardRecipe,
  type RecipeInnerLayout,
  type RecipeLegend,
  type RecipePanel,
  type RecipePanelType,
  type RecipeQuery,
  type RecipeRow,
  type RecipeSection,
  type RecipeThreshold,
  type RecipeThresholdColor,
  type RecipeVariable,
} from './recipe';

/**
 * Composes a compact {@link DashboardRecipe} into a strict `DashboardV2Spec`.
 *
 * Panels are laid out in a 24-column grid using a simple next-fit packer; the
 * composer picks sensible defaults per panel type (row height, legend, viz
 * options) so that recipes stay small.
 *
 * The recipe is treated as untrusted (it comes from an LLM). Every field is either
 * validated, clamped, or defaulted here — the caller never has to worry about
 * schema conformance.
 */
export function composeRecipe(recipe: DashboardRecipe): DashboardV2Spec {
  const base = defaultDashboardV2Spec();

  const variables = (recipe.variables ?? []).map(buildVariable);

  // Build the layout tree + the flat element map in one pass. The builder walks
  // sections (or falls back to the flat panel list) and produces the appropriate
  // V2 layout kind. Every panel is registered in `elements` under a unique key
  // referenced by the layout items.
  const builder = new LayoutTreeBuilder();
  const layout = builder.build(recipe);

  const spec: DashboardV2Spec = {
    ...base,
    title: recipe.title.trim() || t('dashboard-generate.compose.default-title', 'Generated dashboard'),
    description: recipe.description ?? '',
    tags: Array.isArray(recipe.tags) ? recipe.tags.slice(0, 20) : [],
    editable: true,
    variables,
    elements: builder.elements,
    layout,
  };

  return spec;
}

/** Layout defaults per panel type — chosen so common recipes look reasonable without extra hints. */
const PANEL_DEFAULTS: Record<RecipePanelType, { span: number; height: number; legend: RecipeLegend }> = {
  timeseries: { span: 12, height: 8, legend: 'list' },
  stat: { span: 6, height: 4, legend: 'hidden' },
  gauge: { span: 6, height: 6, legend: 'hidden' },
  bargauge: { span: 12, height: 6, legend: 'hidden' },
  table: { span: 24, height: 8, legend: 'hidden' },
  piechart: { span: 12, height: 8, legend: 'list' },
  heatmap: { span: 24, height: 8, legend: 'hidden' },
  logs: { span: 24, height: 12, legend: 'hidden' },
};

const GRID_WIDTH = 24;

/**
 * Builds a V2 layout tree from a recipe. Encapsulated as a class so we can share
 * two pieces of mutable state (the flat element map and a monotonically-increasing
 * panel id counter) across every recursive layout call without threading them
 * through every helper.
 */
class LayoutTreeBuilder {
  readonly elements: DashboardV2Spec['elements'] = {};
  private nextPanelId = 1;

  /**
   * Chooses the top-level layout kind based on what the recipe asked for:
   * - Non-empty `sections` of a single kind → `TabsLayout` or `RowsLayout`.
   * - Mixed sections → `RowsLayout`, with any tab-only sections nested as a
   *   TabsLayout inside their row. Keeps the user's intent visible without
   *   sacrificing consistency at the top level.
   * - Empty / missing `sections` → fall back to the flat `panels` list rendered
   *   as a single `GridLayout` (the pre-sections behaviour).
   */
  build(recipe: DashboardRecipe): DashboardV2Spec['layout'] {
    const sections = Array.isArray(recipe.sections) ? recipe.sections.filter(hasContent) : [];
    if (sections.length > 0) {
      const kinds = new Set(sections.map((s) => (s.kind === 'tab' ? 'tab' : 'row')));
      if (kinds.size === 1 && sections[0].kind === 'tab') {
        return this.buildTabsLayout(sections);
      }
      return this.buildRowsLayout(sections);
    }

    const flatPanels = Array.isArray(recipe.panels) ? recipe.panels : [];
    return this.buildGridLayout(flatPanels);
  }

  private buildTabsLayout(sections: RecipeSection[]): TabsLayoutKind {
    const tabs: TabsLayoutTabKind[] = sections.map((section) => ({
      kind: 'TabsLayoutTab',
      spec: {
        title: safeTitle(section.title, 'Tab'),
        layout: this.buildSectionBody(section),
      },
    }));
    return { kind: 'TabsLayout', spec: { tabs } };
  }

  private buildRowsLayout(sections: RecipeSection[]): RowsLayoutKind {
    const rows: RowsLayoutRowKind[] = sections.map((section) => {
      // A section that carries its own nested rows (or asked to be a tab) gets its
      // richer body nested inside this row so we never flatten the structure away.
      const nested = section.kind === 'tab' || hasRows(section);
      const layout: GridLayoutKind | AutoGridLayoutKind | TabsLayoutKind | RowsLayoutKind = nested
        ? section.kind === 'tab'
          ? {
              kind: 'TabsLayout',
              spec: {
                tabs: [
                  {
                    kind: 'TabsLayoutTab',
                    spec: { title: safeTitle(section.title, 'Tab'), layout: this.buildSectionBody(section) },
                  },
                ],
              },
            }
          : this.buildSectionBody(section)
        : this.buildInnerLayout(section.panels, section.layout, section.autoColumns);

      return {
        kind: 'RowsLayoutRow',
        spec: {
          title: safeTitle(section.title, 'Row'),
          collapse: section.collapsed === true,
          layout,
        },
      };
    });
    return { kind: 'RowsLayout', spec: { rows } };
  }

  /**
   * A section's body: a nested {@link RowsLayout} when the section carries rows,
   * otherwise a flat grid / auto-grid of its own panels. This is what lets a tab
   * hold an "Overview / Errors / Latency" stack instead of one wall of tiles.
   */
  private buildSectionBody(section: RecipeSection): GridLayoutKind | AutoGridLayoutKind | RowsLayoutKind {
    if (hasRows(section)) {
      return this.buildRowsFromRecipeRows(section.rows ?? []);
    }
    return this.buildInnerLayout(section.panels, section.layout, section.autoColumns);
  }

  private buildRowsFromRecipeRows(rows: RecipeRow[]): RowsLayoutKind {
    const layoutRows: RowsLayoutRowKind[] = rows
      .filter((row) => Array.isArray(row.panels) && row.panels.length > 0)
      .map((row) => ({
        kind: 'RowsLayoutRow',
        spec: {
          title: safeTitle(row.title, 'Row'),
          collapse: row.collapsed === true,
          layout: this.buildInnerLayout(row.panels, row.layout, row.autoColumns),
        },
      }));
    return { kind: 'RowsLayout', spec: { rows: layoutRows } };
  }

  private buildInnerLayout(
    panels: RecipePanel[] | undefined,
    layoutHint: RecipeInnerLayout | undefined,
    autoColumns: number | undefined
  ): GridLayoutKind | AutoGridLayoutKind {
    // When no explicit hint is given, auto-detect: a uniform strip of small
    // tiles (stats / gauges) reads best as a responsive auto-grid; anything with
    // mixed panel shapes packs into the 24-column grid.
    const resolved = layoutHint ? normaliseInnerLayout(layoutHint) : detectInnerLayout(panels);
    if (resolved === 'auto') {
      return this.buildAutoGridLayout(panels, autoColumns);
    }
    return this.buildGridLayout(panels);
  }

  private buildGridLayout(panels: RecipePanel[] | undefined): GridLayoutKind {
    const items = this.packGrid(panels);
    return { kind: 'GridLayout', spec: { items } };
  }

  private buildAutoGridLayout(panels: RecipePanel[] | undefined, autoColumns: number | undefined): AutoGridLayoutKind {
    const safePanels = Array.isArray(panels) ? panels : [];
    const items = safePanels.map((panel) => {
      const type = normalisePanelType(panel.type);
      const elementName = this.registerPanel(panel, type);
      return {
        kind: 'AutoGridLayoutItem' as const,
        spec: { element: { kind: 'ElementReference' as const, name: elementName } },
      };
    });
    // Default the column cap to the panel count (so a strip of 4 KPIs sits on one
    // row) but never wider than 6, which keeps tiles a sensible size.
    const defaultColumns = Math.min(Math.max(safePanels.length, 1), 6);
    return {
      kind: 'AutoGridLayout',
      spec: {
        maxColumnCount: clamp(autoColumns ?? defaultColumns, 1, 6),
        columnWidthMode: 'standard',
        rowHeightMode: 'standard',
        fillScreen: false,
        items,
      },
    };
  }

  /**
   * Packs recipe panels into a 24-column grid using a simple next-fit packer.
   * Row-by-row, no backtracking — identical recipes produce identical output,
   * which matters for review / diff workflows.
   */
  private packGrid(panels: RecipePanel[] | undefined): GridLayoutItemKind[] {
    const safePanels = Array.isArray(panels) ? panels : [];
    const items: GridLayoutItemKind[] = [];

    let cursorX = 0;
    let rowTop = 0;
    let rowMaxHeight = 0;

    safePanels.forEach((panel) => {
      const type = normalisePanelType(panel.type);
      const defaults = PANEL_DEFAULTS[type];
      const span = clamp(panel.span ?? defaults.span, 3, GRID_WIDTH);
      const height = clamp(panel.height ?? defaults.height, 3, 40);

      if (cursorX + span > GRID_WIDTH) {
        rowTop += rowMaxHeight;
        cursorX = 0;
        rowMaxHeight = 0;
      }

      const elementName = this.registerPanel(panel, type);

      items.push({
        kind: 'GridLayoutItem',
        spec: {
          x: cursorX,
          y: rowTop,
          width: span,
          height,
          element: { kind: 'ElementReference', name: elementName },
        },
      });

      cursorX += span;
      rowMaxHeight = Math.max(rowMaxHeight, height);
      if (cursorX >= GRID_WIDTH) {
        rowTop += rowMaxHeight;
        cursorX = 0;
        rowMaxHeight = 0;
      }
    });

    return items;
  }

  private registerPanel(panel: RecipePanel, type: RecipePanelType): string {
    const panelId = this.nextPanelId++;
    const elementName = `panel-${panelId}`;
    this.elements[elementName] = buildPanel(panelId, panel, type);
    return elementName;
  }
}

function hasRows(section: RecipeSection): boolean {
  return Array.isArray(section.rows) && section.rows.some((row) => Array.isArray(row.panels) && row.panels.length > 0);
}

function hasContent(section: RecipeSection): boolean {
  return hasRows(section) || (Array.isArray(section.panels) && section.panels.length > 0);
}

/** Panel types that read best as uniform tiles in a responsive auto-grid. */
const UNIFORM_AUTO_TYPES: ReadonlySet<RecipePanelType> = new Set(['stat', 'gauge', 'bargauge']);

/**
 * Picks an inner layout when the recipe gave no explicit hint: a strip made
 * entirely of small uniform tiles (stats / gauges) becomes a responsive
 * auto-grid; everything else packs into the 24-column grid where hero and
 * supporting panels can take different widths.
 */
function detectInnerLayout(panels: RecipePanel[] | undefined): RecipeInnerLayout {
  const safePanels = Array.isArray(panels) ? panels : [];
  if (safePanels.length >= 2 && safePanels.every((panel) => UNIFORM_AUTO_TYPES.has(normalisePanelType(panel.type)))) {
    return 'auto';
  }
  return 'grid';
}

function safeTitle(title: string | undefined, fallback: string): string {
  const trimmed = (title ?? '').toString().trim();
  return trimmed || fallback;
}

const KNOWN_INNER_LAYOUTS: readonly RecipeInnerLayout[] = ['grid', 'auto'];
function normaliseInnerLayout(hint: string | undefined): RecipeInnerLayout {
  if (typeof hint === 'string') {
    const lower = hint.toLowerCase();
    for (const known of KNOWN_INNER_LAYOUTS) {
      if (known === lower) {
        return known;
      }
    }
  }
  return 'grid';
}

const KNOWN_PANEL_TYPES: readonly RecipePanelType[] = [
  'timeseries',
  'stat',
  'gauge',
  'bargauge',
  'table',
  'piechart',
  'heatmap',
  'logs',
];

function normalisePanelType(type: string | undefined): RecipePanelType {
  const trimmed = typeof type === 'string' ? type.trim().toLowerCase() : '';
  for (const known of KNOWN_PANEL_TYPES) {
    if (known === trimmed) {
      return known;
    }
  }
  return 'timeseries';
}

function buildPanel(id: number, panel: RecipePanel, type: RecipePanelType): Element {
  return {
    kind: 'Panel',
    spec: {
      id,
      title: (panel.title ?? '').toString().trim() || 'Panel',
      description: (panel.description ?? '').toString(),
      links: [],
      data: {
        kind: 'QueryGroup',
        spec: {
          queries: buildPanelQueries(panel.queries),
          transformations: [],
          queryOptions: {},
        },
      },
      vizConfig: {
        kind: 'VizConfig',
        group: type,
        version: '12.0.0',
        spec: {
          fieldConfig: buildFieldConfig(panel),
          options: buildPanelOptions(type, panel),
        },
      },
    },
  };
}

function buildPanelQueries(queries: RecipeQuery[] | undefined) {
  const safeQueries = Array.isArray(queries) ? queries : [];
  return safeQueries.map((query, index) => {
    const refId = query.refId?.trim() || String.fromCharCode(65 + Math.min(index, 25));
    const querySpec: Record<string, unknown> = {
      expr: (query.expr ?? '').toString(),
      refId,
    };
    if (query.legendFormat) {
      querySpec.legendFormat = query.legendFormat;
    }
    if (typeof query.instant === 'boolean') {
      querySpec.instant = query.instant;
      querySpec.range = !query.instant;
    }
    if (query.format) {
      querySpec.format = query.format;
    }

    return {
      kind: 'PanelQuery' as const,
      spec: {
        refId,
        hidden: false,
        query: {
          kind: 'DataQuery' as const,
          group: 'prometheus',
          version: 'v0',
          datasource: { name: query.datasourceUid },
          spec: querySpec,
        },
      },
    };
  });
}

interface BuiltFieldConfig {
  defaults: {
    unit?: string;
    min?: number;
    max?: number;
    decimals?: number;
    color?: { mode: FieldColorModeId };
    thresholds?: {
      mode: 'absolute';
      steps: Array<{ value: number | null; color: string }>;
    };
  };
  overrides: never[];
}

function buildFieldConfig(panel: RecipePanel): BuiltFieldConfig {
  const defaults: BuiltFieldConfig['defaults'] = {};
  if (panel.unit) {
    defaults.unit = panel.unit;
  }
  if (typeof panel.min === 'number') {
    defaults.min = panel.min;
  }
  if (typeof panel.max === 'number') {
    defaults.max = panel.max;
  }
  if (typeof panel.decimals === 'number') {
    defaults.decimals = clamp(panel.decimals, 0, 10);
  }

  if (Array.isArray(panel.thresholds) && panel.thresholds.length > 0) {
    defaults.thresholds = {
      mode: 'absolute',
      steps: buildThresholdSteps(panel.thresholds),
    };
    defaults.color = { mode: 'thresholds' };
  }

  return { defaults, overrides: [] };
}

function buildThresholdSteps(thresholds: RecipeThreshold[]): Array<{ value: number | null; color: string }> {
  const steps: Array<{ value: number | null; color: string }> = [];
  let hasBase = false;

  for (const threshold of thresholds) {
    const color = normaliseColor(threshold.color);
    if (threshold.value === null || threshold.value === undefined) {
      if (!hasBase) {
        steps.push({ value: null, color });
        hasBase = true;
      }
      continue;
    }
    if (Number.isFinite(threshold.value)) {
      steps.push({ value: threshold.value, color });
    }
  }

  if (!hasBase) {
    steps.unshift({ value: null, color: 'green' });
  }
  steps.sort((a, b) => {
    if (a.value === null) {
      return -1;
    }
    if (b.value === null) {
      return 1;
    }
    return a.value - b.value;
  });
  return steps;
}

const ALLOWED_COLORS: readonly RecipeThresholdColor[] = ['green', 'yellow', 'orange', 'red', 'blue', 'purple'];

function normaliseColor(color: unknown): string {
  if (typeof color !== 'string') {
    return 'green';
  }
  const lower = color.toLowerCase();
  for (const allowed of ALLOWED_COLORS) {
    if (allowed === lower) {
      return allowed;
    }
  }
  return 'green';
}

function buildPanelOptions(type: RecipePanelType, panel: RecipePanel): Record<string, unknown> {
  const legend = normaliseLegend(panel.legend ?? PANEL_DEFAULTS[type].legend);

  switch (type) {
    case 'timeseries':
      return {
        legend: {
          showLegend: legend !== 'hidden',
          displayMode: legend === 'hidden' ? 'list' : legend,
          placement: 'bottom',
          calcs: [],
        },
        tooltip: { mode: 'multi', sort: 'none' },
      };
    case 'stat':
      return {
        reduceOptions: { calcs: ['lastNotNull'], values: false, fields: '' },
        textMode: 'auto',
        graphMode: 'area',
        colorMode: panel.thresholds ? 'value' : 'none',
        justifyMode: 'auto',
        orientation: 'auto',
      };
    case 'gauge':
      return {
        reduceOptions: { calcs: ['lastNotNull'], values: false, fields: '' },
        showThresholdLabels: false,
        showThresholdMarkers: true,
        orientation: 'auto',
      };
    case 'bargauge':
      return {
        reduceOptions: { calcs: ['lastNotNull'], values: false, fields: '' },
        orientation: 'horizontal',
        displayMode: 'gradient',
        showUnfilled: true,
      };
    case 'table':
      return {
        showHeader: true,
        cellHeight: 'sm',
        footer: { show: false },
      };
    case 'piechart':
      return {
        pieType: 'donut',
        displayLabels: ['percent'],
        legend: {
          showLegend: legend !== 'hidden',
          displayMode: legend === 'hidden' ? 'list' : legend,
          placement: 'right',
          values: ['percent'],
        },
        reduceOptions: { calcs: ['lastNotNull'], values: false, fields: '' },
      };
    case 'heatmap':
      return {
        yAxis: { axisPlacement: 'left', reverse: false },
        cellGap: 1,
        color: { scheme: 'Spectral', mode: 'scheme', exponent: 0.5, steps: 64 },
      };
    case 'logs':
      return {
        showTime: true,
        showLabels: false,
        showCommonLabels: false,
        wrapLogMessage: true,
        sortOrder: 'Descending',
      };
    default:
      return {};
  }
}

function normaliseLegend(legend: string | undefined): RecipeLegend {
  if (legend === 'hidden' || legend === 'list' || legend === 'table') {
    return legend;
  }
  return 'list';
}

/**
 * Builds a V2 `QueryVariableKind` from a recipe variable. We always use
 * `label_values(<key>)`, which is the shape the Assistant / LLM is best trained
 * on and covers >90% of dashboard variables in practice.
 */
function buildVariable(variable: RecipeVariable): DashboardV2Spec['variables'][number] {
  const includeAll = variable.includeAll ?? variable.multi ?? true;
  const multi = variable.multi ?? true;
  const definition = `label_values(${variable.labelKey})`;

  const kind: DashboardV2Spec['variables'][number] = {
    kind: 'QueryVariable',
    spec: {
      name: variable.name,
      label: variable.label ?? variable.name,
      current: includeAll
        ? {
            text: t('dashboard-generate.compose.variable-all', 'All'),
            value: '$__all',
            selected: true,
          }
        : { text: '', value: '' },
      hide: 'dontHide',
      refresh: 'onDashboardLoad',
      skipUrlSync: false,
      definition,
      query: {
        kind: 'DataQuery',
        group: 'prometheus',
        version: 'v0',
        datasource: { name: variable.datasourceUid },
        // Prometheus scene variables read the legacy string wrapper. Keeping this
        // shape means the variable renders correctly without the `datasource-plugin`
        // side of the schema resolving `spec` to a typed query.
        spec: { __legacyStringValue: definition },
      },
      regex: variable.regex ?? '',
      sort: variable.sort ?? 'alphabeticalAsc',
      options: [],
      multi,
      includeAll,
      allValue: includeAll ? '.*' : undefined,
      allowCustomValue: true,
    },
  };
  return kind;
}

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) {
    return min;
  }
  return Math.max(min, Math.min(max, value));
}
