import { DashboardCursorSync } from './dashboard.gen';
import { DashboardV2 } from './dashboard.schema';

export const fullDashboardV2: DashboardV2 = {
  kind: 'Dashboard',
  spec: {
    id: 1,
    title: 'Full Dashboard',
    description: 'This is a full dashboard with all possible fields.',
    cursorSync: DashboardCursorSync.Off,
    liveNow: false,
    preload: false,
    editable: true,
    links: [
      {
        title: 'Example Link',
        url: 'https://example.com',
        icon: 'external-link',
        tooltip: 'Example Tooltip',
        asDropdown: false,
        includeVars: false,
        keepTime: false,
        tags: [],
        targetBlank: false,
        type: 'link',
      },
    ],
    tags: ['tag1', 'tag2'],
    timeSettings: {
      timezone: 'browser',
      from: 'now-6h',
      to: 'now',
      autoRefresh: '10s',
      autoRefreshIntervals: ['10s', '1m', '5m', '15m', '30m', '1h', '6h', '12h', '1d'],
      quickRanges: ['now/d', 'now/w', 'now/M', 'now/y'],
      hideTimepicker: false,
      weekStart: 'sunday',
      fiscalYearStartMonth: 1,
    },
    variables: [
      {
        kind: 'QueryVariable',
        spec: {
          name: 'queryVar',
          query: {
            kind: 'prometheus',
            spec: {
              query: 'up',
            },
          },
          datasource: { uid: 'gdev-prometheus', type: 'prometheus' },
          refresh: 1,
          regex: '',
          sort: 1,
          multi: false,
          includeAll: false,
          allValue: '',
          current: {
            text: 'current',
            value: 'current',
          },
          options: [
            {
              text: 'option1',
              value: 'option1',
            },
          ],
        },
      },
      {
        kind: 'TextVariable',
        spec: {
          name: 'textVar',
          value: 'textValue',
        },
      },
    ],
    elements: {
      timeSeriesTest: {
        kind: 'Panel',
        spec: {
          title: 'Time Series Test',
          description: 'This is a test panel',
          uid: 'timeSeriesTest',
          links: [],
          data: {
            kind: 'QueryGroup',
            spec: {
              queries: [
                {
                  kind: 'PanelQuery',
                  spec: {
                    query: {
                      kind: 'prometheus',
                      spec: {
                        query: 'up',
                      },
                    },
                    datasource: { uid: 'gdev-prometheus', type: 'prometheus' },
                    hidden: false,
                    refId: 'A',
                  },
                },
              ],
              transformations: [
                {
                  kind: 'LimitTransformation',
                  spec: {
                    id: 'limit',
                    options: {
                      limit: 10,
                    },
                  },
                },
              ],
              queryOptions: {
                maxDataPoints: 100,
                cacheTimeout: '1m',
              },
            },
          },
          vizConfig: {
            kind: 'timeseries',
            spec: {
              pluginVersion: '11.0.0',
              options: {},
              fieldConfig: {
                defaults: {},
                overrides: [],
              },
            },
          },
        },
      },
    },
    layout: {
      kind: 'GridLayout',
      spec: {
        items: [
          {
            kind: 'GridLayoutItem',
            spec: {
              element: { kind: 'ElementReference', spec: { name: 'timeSeriesTest' } },
              x: 0,
              y: 0,
              width: 12,
              height: 6,
            },
          },
        ],
      },
    },
    annotations: [
      {
        kind: 'AnnotationQuery',
        spec: {
          datasource: { type: 'datasource', uid: 'grafana' },
          query: {
            kind: 'grafana',
            spec: {
              queryType: 'timeRegions',
              matchAny: false,
              timeRegion: {
                from: '12:27',
                fromDayOfWeek: 2,
                timezone: 'browser',
                to: '11:30',
                toDayOfWeek: 2,
              },
            },
          },
          enable: true,
          filter: {
            ids: [],
          },
          hide: false,
          iconColor: 'blue',
          name: 'Grafana annotations',
        },
      },
      {
        kind: 'AnnotationQuery',
        spec: {
          datasource: { uid: 'gdev-prometheus', type: 'prometheus' },
          query: {
            kind: 'prometheus',
            spec: {
              query: 'up',
            },
          },
          enable: true,
          filter: {
            ids: [],
          },
          hide: false,
          iconColor: 'red',
          name: 'Prometheus annotations',
        },
      },
    ],
  },
};
