import {
  type AutoGridLayoutKind,
  type GridLayoutKind,
  type PanelKind,
  type RowsLayoutKind,
  type RowsLayoutRowKind,
  type Spec as DashboardV2Spec,
  type TabsLayoutKind,
  type TabsLayoutTabKind,
} from '../../../../packages/grafana-schema/src/schema/dashboard/v2';

/**
 * Text panels keyed `panel-<n>`, in the order given. Text panels need no data source, so the
 * drag and drop specs only depend on layout.
 */
export function textPanels(grafanaVersion: string, titles: string[]): Record<string, PanelKind> {
  return Object.fromEntries(
    titles.map((title, index): [string, PanelKind] => [
      `panel-${index + 1}`,
      {
        kind: 'Panel',
        spec: {
          id: index + 1,
          title,
          description: '',
          links: [],
          data: { kind: 'QueryGroup', spec: { queries: [], queryOptions: {}, transformations: [] } },
          vizConfig: {
            kind: 'VizConfig',
            group: 'text',
            version: grafanaVersion,
            spec: {
              options: { mode: 'markdown', content: `Content of ${title}` },
              fieldConfig: { defaults: {}, overrides: [] },
            },
          },
        },
      },
    ])
  );
}

/** Reference to the element whose panel has this title */
export function elementRef(elements: Record<string, PanelKind>, title: string) {
  const name = Object.keys(elements).find((key) => elements[key].spec.title === title);
  if (!name) {
    throw new Error(`No panel titled "${title}" in the dashboard elements`);
  }

  return { kind: 'ElementReference' as const, name };
}

/** Auto grid holding the panels with these titles, in order */
export function autoGrid(elements: Record<string, PanelKind>, titles: string[]): AutoGridLayoutKind {
  return {
    kind: 'AutoGridLayout',
    spec: {
      maxColumnCount: 3,
      columnWidthMode: 'standard',
      rowHeightMode: 'standard',
      items: titles.map((title) => ({ kind: 'AutoGridLayoutItem', spec: { element: elementRef(elements, title) } })),
    },
  };
}

export function rowsLayout(rows: RowsLayoutRowKind[]): RowsLayoutKind {
  return { kind: 'RowsLayout', spec: { rows } };
}

export function row(
  title: string,
  layout: RowsLayoutRowKind['spec']['layout'],
  { collapse = false } = {}
): RowsLayoutRowKind {
  return { kind: 'RowsLayoutRow', spec: { title, collapse, layout } };
}

export function tabsLayout(tabs: TabsLayoutTabKind[]): TabsLayoutKind {
  return { kind: 'TabsLayout', spec: { tabs } };
}

export function tab(title: string, layout: TabsLayoutTabKind['spec']['layout']): TabsLayoutTabKind {
  return { kind: 'TabsLayoutTab', spec: { title, layout } };
}

export function dashboardSpec(
  title: string,
  elements: Record<string, PanelKind>,
  layout: GridLayoutKind | RowsLayoutKind | AutoGridLayoutKind | TabsLayoutKind
): DashboardV2Spec {
  return {
    title,
    description: '',
    annotations: [],
    cursorSync: 'Off',
    editable: true,
    links: [],
    liveNow: false,
    preload: false,
    tags: [],
    variables: [],
    elements,
    layout,
    timeSettings: {
      autoRefresh: '',
      autoRefreshIntervals: ['5s', '10s', '30s', '1m', '5m', '15m', '30m', '1h', '2h', '1d'],
      fiscalYearStartMonth: 0,
      from: 'now-6h',
      to: 'now',
      hideTimepicker: false,
      timezone: 'browser',
    },
  };
}
