import {
  type PanelKind,
  type Spec as DashboardV2Spec,
} from '../../../../packages/grafana-schema/src/schema/dashboard/v2';

export function buildDashboardRepeatsSpec(
  grafanaVersion: string,
  { repeatsEnabled = true }: { repeatsEnabled?: boolean } = {}
): DashboardV2Spec {
  return {
    annotations: [],
    cursorSync: 'Off',
    description: '',
    editable: true,
    links: [],
    liveNow: false,
    preload: false,
    tags: [],
    timeSettings: {
      autoRefresh: '',
      autoRefreshIntervals: ['5s', '10s', '30s', '1m', '5m', '15m', '30m', '1h', '2h', '1d'],
      fiscalYearStartMonth: 0,
      from: 'now-6h',
      hideTimepicker: false,
      timezone: 'browser',
      to: 'now',
    },
    title: 'Auto-grid repeats',
    elements: {
      'panel-1': buildPanel(1, repeatsEnabled ? 'repeat - $c1' : 'New panel', grafanaVersion),
      'panel-2': buildPanel(2, 'New panel', grafanaVersion),
      'panel-3': buildPanel(3, 'New panel', grafanaVersion),
    },
    layout: {
      kind: 'AutoGridLayout',
      spec: {
        maxColumnCount: 3,
        columnWidthMode: 'standard',
        rowHeightMode: 'standard',
        items: (repeatsEnabled ? [1, 2, 3] : [1, 3, 2]).map((id) => ({
          kind: 'AutoGridLayoutItem',
          spec: {
            element: { kind: 'ElementReference', name: `panel-${id}` },
            ...(repeatsEnabled && id === 1 ? { repeat: { mode: 'variable' as const, value: 'c1' } } : {}),
          },
        })),
      },
    },
    variables: [
      {
        kind: 'CustomVariable',
        spec: {
          allowCustomValue: true,
          current: {
            text: ['1', '2', '3', '4'],
            value: ['1', '2', '3', '4'],
          },
          hide: 'dontHide',
          includeAll: true,
          multi: true,
          name: 'c1',
          options: [
            {
              selected: true,
              text: '1',
              value: '1',
            },
            {
              selected: true,
              text: '2',
              value: '2',
            },
            {
              selected: true,
              text: '3',
              value: '3',
            },
            {
              selected: true,
              text: '4',
              value: '4',
            },
          ],
          query: '1,2,3,4',
          skipUrlSync: false,
        },
      },
      {
        kind: 'CustomVariable',
        spec: {
          allowCustomValue: true,
          current: {
            text: ['A', 'B', 'C', 'D'],
            value: ['A', 'B', 'C', 'D'],
          },
          hide: 'dontHide',
          includeAll: true,
          multi: true,
          name: 'c2',
          options: [
            {
              selected: true,
              text: 'A',
              value: 'A',
            },
            {
              selected: true,
              text: 'B',
              value: 'B',
            },
            {
              selected: true,
              text: 'C',
              value: 'C',
            },
            {
              selected: true,
              text: 'D',
              value: 'D',
            },
          ],
          query: 'A,B,C,D',
          skipUrlSync: false,
        },
      },
    ],
  };
}

function buildPanel(id: number, title: string, grafanaVersion: string): PanelKind {
  return {
    kind: 'Panel',
    spec: {
      data: {
        kind: 'QueryGroup',
        spec: {
          queries: [
            {
              kind: 'PanelQuery',
              spec: {
                hidden: false,
                query: {
                  datasource: {
                    name: 'gdev-testdata',
                  },
                  group: 'grafana-testdata-datasource',
                  kind: 'DataQuery',
                  spec: id === 2 ? { scenarioId: 'random_walk', seriesCount: 1 } : {},
                  version: 'v0',
                },
                refId: 'A',
              },
            },
          ],
          queryOptions: {},
          transformations: [],
        },
      },
      description: '',
      id,
      links: [],
      title,
      vizConfig: {
        group: 'timeseries',
        kind: 'VizConfig',
        spec: {
          fieldConfig: {
            defaults: {
              color: {
                mode: 'palette-classic',
              },
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
                hideFrom: {
                  legend: false,
                  tooltip: false,
                  viz: false,
                },
                insertNulls: false,
                lineInterpolation: 'linear',
                lineWidth: 1,
                pointSize: 5,
                scaleDistribution: {
                  type: 'linear',
                },
                showPoints: 'auto',
                showValues: false,
                spanNulls: false,
                stacking: {
                  group: 'A',
                  mode: 'none',
                },
                thresholdsStyle: {
                  mode: 'off',
                },
              },
              thresholds: {
                mode: 'absolute',
                steps: [
                  {
                    color: 'green',
                    value: 0,
                  },
                  {
                    color: 'red',
                    value: 80,
                  },
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
            tooltip: {
              hideZeros: false,
              mode: 'single',
              sort: 'none',
            },
          },
        },
        version: grafanaVersion,
      },
    },
  };
}
