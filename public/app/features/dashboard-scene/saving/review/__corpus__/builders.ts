import { cloneDeep } from 'lodash';

import {
  defaultAnnotationQueryKind,
  defaultAutoGridLayoutItemKind,
  defaultAutoGridLayoutKind,
  defaultCustomVariableKind,
  defaultDashboardLink,
  defaultDataQueryKind,
  defaultGridLayoutItemKind,
  defaultGridLayoutKind,
  defaultLibraryPanelKind,
  defaultPanelKind,
  defaultPanelQueryKind,
  defaultQueryVariableKind,
  defaultRowsLayoutKind,
  defaultRowsLayoutRowKind,
  defaultSpec,
  defaultTabsLayoutKind,
  defaultTabsLayoutTabKind,
  defaultTransformationKind,
  type AnnotationQueryKind,
  type AnnotationQuerySpec,
  type AutoGridLayoutItemKind,
  type AutoGridLayoutItemSpec,
  type AutoGridLayoutKind,
  type AutoGridLayoutSpec,
  type ConditionalRenderingDataKind,
  type ConditionalRenderingGroupKind,
  type ConditionalRenderingGroupSpec,
  type ConditionalRenderingTimeRangeSizeKind,
  type ConditionalRenderingVariableKind,
  type ConditionalRenderingVariableSpec,
  type CustomVariableKind,
  type CustomVariableSpec,
  type DashboardLink,
  type Element,
  type GridLayoutItemKind,
  type GridLayoutItemSpec,
  type GridLayoutKind,
  type LibraryPanelKind,
  type PanelKind,
  type PanelQueryKind,
  type PanelSpec,
  type QueryOptionsSpec,
  type QueryVariableKind,
  type QueryVariableSpec,
  type RowsLayoutKind,
  type RowsLayoutRowKind,
  type RowsLayoutRowSpec,
  type Spec as DashboardV2Spec,
  type TabsLayoutKind,
  type TabsLayoutTabKind,
  type TabsLayoutTabSpec,
  type TransformationKind,
  type VizConfigKind,
} from '@grafana/schema/apis/dashboard.grafana.app/v2';
import { sortedDeepCloneWithoutNulls } from 'app/core/utils/object';

/*
 * Concise builders for realistic v2 save models: every builder fills in what the serializer always
 * writes, so corpus cases differ only where their situation needs them to, and both sides carry the
 * same defaults the engines meet on a real save.
 */

export type Layout = DashboardV2Spec['layout'];

/** Sorted, null-free and with ±Infinity as 0, like `transformSceneToSaveModelSchemaV2`. */
export function normalize<T>(value: T): T {
  return sortedDeepCloneWithoutNulls(value, true);
}

/** Returns a normalized copy of `spec` after `recipe` mutated it. The input is left untouched. */
export function edit(spec: DashboardV2Spec, recipe: (draft: DashboardV2Spec) => void): DashboardV2Spec {
  const draft = cloneDeep(spec);
  recipe(draft);
  return normalize(draft);
}

/** The PanelSpec of `elements[name]`, for use inside `edit` recipes. */
export function panelSpecOf(spec: DashboardV2Spec, name: string): PanelSpec {
  const element = spec.elements[name];
  if (!element || element.kind !== 'Panel') {
    throw new Error(`corpus: elements['${name}'] is not a panel`);
  }
  return element.spec;
}

export function builtInAnnotation(): AnnotationQueryKind {
  return annotation('Annotations & Alerts', {
    builtIn: true,
    enable: true,
    hide: true,
    iconColor: 'rgba(0, 211, 255, 1)',
    query: { ...defaultDataQueryKind(), group: 'grafana', datasource: { name: '-- Grafana --' }, spec: {} },
  });
}

export function dashboard(spec: Partial<DashboardV2Spec> = {}): DashboardV2Spec {
  return normalize<DashboardV2Spec>({
    ...defaultSpec(),
    annotations: [builtInAnnotation()],
    liveNow: false,
    // Dashboard content, not UI text.
    // eslint-disable-next-line @grafana/i18n/no-untranslated-strings
    title: 'Service overview',
    ...spec,
  });
}

export function query(refId: string, expr: string, spec: Record<string, unknown> = {}): PanelQueryKind {
  return {
    ...defaultPanelQueryKind(),
    spec: {
      hidden: false,
      refId,
      query: {
        ...defaultDataQueryKind(),
        group: 'prometheus',
        datasource: { name: 'prometheus-main' },
        spec: { editorMode: 'code', expr, legendFormat: '__auto', range: true, ...spec },
      },
    },
  };
}

export function transformation(id: string, options: Record<string, unknown> = {}): TransformationKind {
  return { ...defaultTransformationKind(), group: id, spec: { options } };
}

/** What `getPanelOptionsWithDefaults` leaves in a time series panel's options. */
export function timeseriesOptions(): Record<string, unknown> {
  return {
    legend: { calcs: [], displayMode: 'list', placement: 'bottom', showLegend: true },
    tooltip: { hideZeros: false, mode: 'single', sort: 'none' },
  };
}

/** What `getPanelOptionsWithDefaults` leaves in a time series panel's field config defaults. */
export function timeseriesFieldConfigDefaults(): Record<string, unknown> {
  return {
    color: { mode: 'palette-classic' },
    custom: {
      axisBorderShow: false,
      axisCenteredZero: false,
      axisColorMode: 'text',
      axisLabel: '',
      axisPlacement: 'auto',
      barAlignment: 0,
      barWidthFactor: 0.6,
      drawStyle: 'line',
      fillOpacity: 0,
      gradientMode: 'none',
      hideFrom: { legend: false, tooltip: false, viz: false },
      insertNulls: false,
      lineInterpolation: 'linear',
      lineWidth: 1,
      pointSize: 5,
      scaleDistribution: { type: 'linear' },
      showPoints: 'auto',
      showValues: false,
      spanNulls: false,
      stacking: { group: 'A', mode: 'none' },
      thresholdsStyle: { mode: 'off' },
    },
    mappings: [],
    thresholds: {
      mode: 'absolute',
      steps: [
        { color: 'green', value: -Infinity },
        { color: 'red', value: 80 },
      ],
    },
  };
}

export interface PanelOptions {
  id?: number;
  description?: string;
  subtitle?: string;
  transparent?: boolean;
  links?: PanelSpec['links'];
  queries?: PanelQueryKind[];
  transformations?: TransformationKind[];
  queryOptions?: QueryOptionsSpec;
  /** Plugin id; defaults to 'timeseries'. */
  viz?: string;
  vizVersion?: string;
  options?: Record<string, unknown>;
  fieldConfigDefaults?: Record<string, unknown>;
  overrides?: VizConfigKind['spec']['fieldConfig']['overrides'];
}

let nextPanelId = 1;

/**
 * A time series panel as the serializer writes it. Pass a stable `id` when a case builds the same panel
 * twice; otherwise ids are handed out in call order.
 */
export function panel(title: string, opts: PanelOptions = {}): PanelKind {
  const viz = opts.viz ?? 'timeseries';
  const isTimeseries = viz === 'timeseries';
  return {
    ...defaultPanelKind(),
    spec: {
      id: opts.id ?? nextPanelId++,
      title,
      description: opts.description ?? '',
      subtitle: opts.subtitle,
      transparent: opts.transparent,
      links: opts.links ?? [],
      data: {
        kind: 'QueryGroup',
        spec: {
          queries: opts.queries ?? [query('A', `rate(http_requests_total{panel="${title}"}[5m])`)],
          transformations: opts.transformations ?? [],
          queryOptions: opts.queryOptions ?? {},
        },
      },
      vizConfig: {
        kind: 'VizConfig',
        group: viz,
        version: opts.vizVersion ?? '11.0.0',
        spec: {
          options: opts.options ?? (isTimeseries ? timeseriesOptions() : {}),
          fieldConfig: {
            defaults: opts.fieldConfigDefaults ?? (isTimeseries ? timeseriesFieldConfigDefaults() : {}),
            overrides: opts.overrides ?? [],
          },
        },
      },
    },
  };
}

export function libraryPanel(title: string, name: string, uid: string, id = nextPanelId++): LibraryPanelKind {
  return { ...defaultLibraryPanelKind(), spec: { id, title, libraryPanel: { name, uid } } };
}

/** Element name → element, e.g. `elements(['panel-1', panel('CPU')])`. */
export function elements(...entries: Array<[string, Element]>): Record<string, Element> {
  return Object.fromEntries(entries);
}

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

export function gridItem(
  name: string,
  { x, y, w, h }: Box,
  extra: Partial<Omit<GridLayoutItemSpec, 'element'>> = {}
): GridLayoutItemKind {
  return {
    ...defaultGridLayoutItemKind(),
    spec: { x, y, width: w, height: h, element: { kind: 'ElementReference', name }, ...extra },
  };
}

export function grid(items: GridLayoutItemKind[]): GridLayoutKind {
  return { ...defaultGridLayoutKind(), spec: { items } };
}

/** A grid of 12 × 8 panels, two per line, in the order given. */
export function gridOf(...names: string[]): GridLayoutKind {
  return grid(names.map((name, i) => gridItem(name, { x: (i % 2) * 12, y: Math.floor(i / 2) * 8, w: 12, h: 8 })));
}

/** A grid of 12 × 8 panels in a single column, in the order given. */
export function stackOf(...names: string[]): GridLayoutKind {
  return grid(names.map((name, i) => gridItem(name, { x: 0, y: i * 8, w: 12, h: 8 })));
}

export function autoGridItem(
  name: string,
  extra: Partial<Omit<AutoGridLayoutItemSpec, 'element'>> = {}
): AutoGridLayoutItemKind {
  return { ...defaultAutoGridLayoutItemKind(), spec: { element: { kind: 'ElementReference', name }, ...extra } };
}

/** An auto grid as the serializer writes it: settings left at their defaults are omitted. */
export function autoGrid(
  items: AutoGridLayoutItemKind[],
  settings: Partial<Omit<AutoGridLayoutSpec, 'items'>> = {}
): AutoGridLayoutKind {
  return {
    ...defaultAutoGridLayoutKind(),
    spec: { columnWidthMode: 'standard', maxColumnCount: 3, rowHeightMode: 'standard', ...settings, items },
  };
}

export function row(
  title: string | undefined,
  layout: Layout,
  extra: Partial<RowsLayoutRowSpec> = {}
): RowsLayoutRowKind {
  return { ...defaultRowsLayoutRowKind(), spec: { title, collapse: false, layout, ...extra } };
}

export function rows(items: RowsLayoutRowKind[]): RowsLayoutKind {
  return { ...defaultRowsLayoutKind(), spec: { rows: items } };
}

export function tab(
  title: string | undefined,
  layout: Layout,
  extra: Partial<TabsLayoutTabSpec> = {}
): TabsLayoutTabKind {
  return { ...defaultTabsLayoutTabKind(), spec: { title, layout, ...extra } };
}

export function tabs(items: TabsLayoutTabKind[]): TabsLayoutKind {
  return { ...defaultTabsLayoutKind(), spec: { tabs: items } };
}

export function customVariable(
  name: string,
  values: string[],
  spec: Partial<CustomVariableSpec> = {}
): CustomVariableKind {
  const options = values.map((value, i) => ({ selected: i === 0, text: value, value }));
  return {
    ...defaultCustomVariableKind(),
    spec: {
      ...defaultCustomVariableKind().spec,
      name,
      query: values.join(','),
      current: { text: values[0] ?? '', value: values[0] ?? '' },
      options,
      ...spec,
    },
  };
}

export function queryVariable(name: string, expr: string, spec: Partial<QueryVariableSpec> = {}): QueryVariableKind {
  return {
    ...defaultQueryVariableKind(),
    spec: {
      ...defaultQueryVariableKind().spec,
      name,
      definition: expr,
      refresh: 'onDashboardLoad',
      query: {
        ...defaultDataQueryKind(),
        group: 'prometheus',
        datasource: { name: 'prometheus-main' },
        spec: { qryType: 1, query: expr, refId: 'PrometheusVariableQueryEditor-VariableQuery' },
      },
      ...spec,
    },
  };
}

export function annotation(name: string, spec: Partial<AnnotationQuerySpec> = {}): AnnotationQueryKind {
  const base = defaultAnnotationQueryKind();
  return {
    ...base,
    spec: {
      builtIn: false,
      enable: true,
      hide: false,
      iconColor: 'red',
      name,
      query: { ...defaultDataQueryKind(), group: 'prometheus', datasource: { name: 'prometheus-main' }, spec: {} },
      ...spec,
    },
  };
}

/** A dashboard link as the links editor creates it (no placement). */
export function dashboardLink(title: string, url: string, extra: Partial<DashboardLink> = {}): DashboardLink {
  return { ...defaultDashboardLink(), placement: undefined, title, url, ...extra };
}

/** Show / hide rules (`conditionalRendering`) as the editor serializes them. */
export function showHideRules(
  visibility: ConditionalRenderingGroupSpec['visibility'],
  condition: ConditionalRenderingGroupSpec['condition'],
  items: ConditionalRenderingGroupSpec['items']
): ConditionalRenderingGroupKind {
  return { kind: 'ConditionalRenderingGroup', spec: { condition, items, visibility } };
}

export function variableRule(
  variable: string,
  operator: ConditionalRenderingVariableSpec['operator'],
  value: string
): ConditionalRenderingVariableKind {
  return { kind: 'ConditionalRenderingVariable', spec: { operator, value, variable } };
}

export function dataRule(value: boolean): ConditionalRenderingDataKind {
  return { kind: 'ConditionalRenderingData', spec: { value } };
}

export function timeRangeRule(value: string): ConditionalRenderingTimeRangeSizeKind {
  return { kind: 'ConditionalRenderingTimeRangeSize', spec: { value } };
}

/** Tagged template for expected texts: drops the first and last newline, keeps backslashes as written. */
export function text(strings: TemplateStringsArray, ...values: unknown[]): string {
  return String.raw(strings, ...values)
    .replace(/^\n/, '')
    .replace(/\n$/, '');
}
