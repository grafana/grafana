import {
  type AutoGridLayoutKind,
  type ConditionalRenderingGroupKind,
  type PanelKind,
  type Spec as DashboardV2Spec,
} from '../../../../packages/grafana-schema/src/schema/dashboard/v2';

export function buildDashboardEditModeSpec(grafanaVersion: string): DashboardV2Spec {
  const hide = (rule: ConditionalRenderingGroupKind['spec']['items'][number]): ConditionalRenderingGroupKind => ({
    kind: 'ConditionalRenderingGroup',
    spec: { condition: 'and', visibility: 'hide', items: [rule] },
  });

  const grid = (panelKey?: string, conditionalRendering?: ConditionalRenderingGroupKind): AutoGridLayoutKind => ({
    kind: 'AutoGridLayout',
    spec: {
      columnWidthMode: 'standard',
      rowHeightMode: 'standard',
      maxColumnCount: 3,
      items: panelKey
        ? [
            {
              kind: 'AutoGridLayoutItem',
              spec: {
                element: { kind: 'ElementReference', name: panelKey },
                ...(conditionalRendering ? { conditionalRendering } : {}),
              },
            },
          ]
        : [],
    },
  });

  const panel = (id: number, title: string, seriesCount?: number): PanelKind => ({
    kind: 'Panel',
    spec: {
      id,
      title,
      description: '',
      links: [],
      data: {
        kind: 'QueryGroup',
        spec: {
          queries: [
            {
              kind: 'PanelQuery',
              spec: {
                refId: 'A',
                hidden: false,
                query:
                  seriesCount === undefined
                    ? { kind: 'DataQuery', group: '', version: 'v0', spec: {} }
                    : {
                        kind: 'DataQuery',
                        group: 'grafana-testdata-datasource',
                        version: 'v0',
                        datasource: { name: 'PD8C576611E62080A' },
                        spec: { scenarioId: 'random_walk', seriesCount },
                      },
              },
            },
          ],
          queryOptions: {},
          transformations: [],
        },
      },
      vizConfig: {
        kind: 'VizConfig',
        group: 'timeseries',
        version: grafanaVersion,
        spec: {
          fieldConfig: {
            defaults: {
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
              thresholds: {
                mode: 'absolute',
                steps: [
                  { color: 'green', value: 0 },
                  { color: 'red', value: 80 },
                ],
              },
            },
            overrides: [],
          },
          options: {
            legend: {
              calcs: [],
              displayMode: 'list',
              placement: 'bottom',
              showLegend: true,
            },
            tooltip: { hideZeros: false, mode: 'single', sort: 'none' },
          },
        },
      },
    },
  });

  return {
    title: 'New dashboard',
    annotations: [
      {
        kind: 'AnnotationQuery',
        spec: {
          builtIn: true,
          enable: true,
          hide: true,
          iconColor: 'rgba(0, 211, 255, 1)',
          name: 'Annotations & Alerts',
          query: {
            kind: 'DataQuery',
            group: 'grafana',
            version: 'v0',
            datasource: { name: '-- Grafana --' },
            spec: {},
          },
        },
      },
    ],
    cursorSync: 'Off',
    editable: true,
    links: [],
    liveNow: false,
    preload: false,
    tags: [],
    elements: {
      'panel-3': panel(3, 'Panel 1'),
      'panel-4': panel(4, 'Panel 3', 5),
      'panel-5': panel(5, 'Panel 2', 3),
    },
    layout: {
      kind: 'RowsLayout',
      spec: {
        rows: [
          {
            kind: 'RowsLayoutRow',
            spec: {
              title: 'Row A',
              collapse: false,
              layout: grid('panel-3'),
              conditionalRendering: hide({
                kind: 'ConditionalRenderingVariable',
                spec: {
                  variable: 'letter',
                  operator: 'equals',
                  value: 'alpha',
                },
              }),
            },
          },
          {
            kind: 'RowsLayoutRow',
            spec: {
              title: 'Row B',
              collapse: false,
              layout: {
                kind: 'TabsLayout',
                spec: {
                  tabs: [
                    {
                      kind: 'TabsLayoutTab',
                      spec: {
                        title: 'Tab one',
                        layout: grid('panel-5'),
                        conditionalRendering: hide({
                          kind: 'ConditionalRenderingTimeRangeSize',
                          spec: { value: '30m' },
                        }),
                      },
                    },
                  ],
                },
              },
            },
          },
          {
            kind: 'RowsLayoutRow',
            spec: {
              title: 'Row C',
              collapse: false,
              layout: grid(
                'panel-4',
                hide({
                  kind: 'ConditionalRenderingData',
                  spec: { value: true },
                })
              ),
            },
          },
        ],
      },
    },
    preferences: { layout: grid() },
    timeSettings: {
      autoRefresh: '',
      autoRefreshIntervals: ['5s', '10s', '30s', '1m', '5m', '15m', '30m', '1h', '2h', '1d'],
      fiscalYearStartMonth: 0,
      from: 'now-15m',
      to: 'now',
      hideTimepicker: false,
      timezone: 'browser',
    },
    variables: [
      {
        kind: 'CustomVariable',
        spec: {
          name: 'letter',
          query: 'alpha, beta, gamma',
          valuesFormat: 'csv',
          current: { text: 'alpha', value: 'alpha' },
          options: [],
          allowCustomValue: false,
          hide: 'dontHide',
          includeAll: false,
          multi: false,
          skipUrlSync: false,
        },
      },
    ],
  };
}
