import { DashboardCursorSync, DashboardV2Spec } from './dashboard.gen';

export const handyTestingSchema: DashboardV2Spec = {
  id: 1,
  title: 'Default Dashboard',
  description: 'This is a default dashboard',
  cursorSync: DashboardCursorSync.Off,
  liveNow: false,
  preload: false,
  editable: true,
  links: [],
  tags: [],
  schemaVersion: 39,
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
                kind: 'limit',
                spec: {
                  id: 'limit', // id is competing w/ kind
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
            element: { kind: 'ElementReference', name: 'timeSeriesTest' },
            x: 0,
            y: 0,
            width: 12,
            height: 6,
          },
        },
      ],
    },
  },
  variables: [],
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
};
