import { DashboardV2Spec } from './types.gen';

export const handyTestingSchema: DashboardV2Spec = {
  title: 'Default Dashboard',
  description: 'This is a default dashboard',
  cursorSync: 'Off',
  liveNow: false,
  preload: false,
  editable: true,
  tags: ['tag1', 'tag2'],
  timeSettings: {
    autoRefresh: '5s',
    autoRefreshIntervals: ['5s', '10s', '30s'],
    fiscalYearStartMonth: 1,
    from: 'now-1h',
    hideTimepicker: false,
    nowDelay: '1m',
    timezone: 'UTC',
    to: 'now',
    weekStart: 'monday',
  },
  annotations: [
    {
      kind: 'AnnotationQuery',
      spec: {
        builtIn: false,
        query: {
          kind: 'prometheus',
          spec: {
            expr: 'test-query',
          },
        },
        datasource: {
          type: 'prometheus',
          uid: 'uid',
        },
        filter: { ids: [1] },
        enable: true,
        hide: false,
        iconColor: 'rgba(0, 211, 255, 1)',
        name: 'Annotations & Alerts',
      },
    },
    {
      kind: 'AnnotationQuery',
      spec: {
        builtIn: false,
        datasource: {
          type: 'grafana-testdata-datasource',
          uid: 'uid',
        },
        enable: true,
        iconColor: 'red',
        name: 'Enabled',
        query: {
          kind: 'grafana-testdata-datasource',
          spec: {
            lines: 4,
            refId: 'Anno',
            scenarioId: 'annotations',
          },
        },
        hide: true,
      },
    },
    {
      kind: 'AnnotationQuery',
      spec: {
        builtIn: false,
        datasource: {
          type: 'grafana-testdata-datasource',
          uid: 'uid',
        },
        enable: false,
        iconColor: 'yellow',
        name: 'Disabled',
        query: {
          kind: 'grafana-testdata-datasource',
          spec: { lines: 5, refId: 'Anno', scenarioId: 'annotations' },
        },
        hide: false,
      },
    },
    {
      kind: 'AnnotationQuery',
      spec: {
        builtIn: false,
        datasource: {
          type: 'grafana-testdata-datasource',
          uid: 'uid',
        },
        enable: true,
        hide: true,
        iconColor: 'dark-purple',
        name: 'Hidden',
        query: {
          kind: 'grafana-testdata-datasource',
          spec: {
            lines: 6,
            refId: 'Anno',
            scenarioId: 'annotations',
          },
        },
      },
    },
  ],
  elements: {
    'panel-1': {
      kind: 'Panel',
      spec: {
        data: {
          kind: 'QueryGroup',
          spec: {
            queries: [
              {
                kind: 'PanelQuery',
                spec: {
                  refId: 'A',
                  datasource: {
                    type: 'prometheus',
                    uid: 'datasource1',
                  },
                  query: {
                    kind: 'prometheus',
                    spec: {
                      expr: 'test-query',
                    },
                  },
                  hidden: false,
                },
              },
            ],
            queryOptions: {
              timeFrom: '1h',
              maxDataPoints: 100,
              timeShift: '1h',
              queryCachingTTL: 60,
              interval: '1m',
              cacheTimeout: '1m',
              hideTimeOverride: false,
            },
            transformations: [
              {
                kind: 'limit',
                spec: {
                  id: 'limit',
                  disabled: false,
                  filter: {
                    id: 'byValue',
                    options: {
                      reducer: 'sum',
                    },
                  },
                  options: {
                    limit: 10,
                  },
                },
              },
            ],
          },
        },
        description: 'Test Description',
        links: [
          { title: 'Test Link 1', url: 'http://test1.com', targetBlank: true },
          { title: 'Test Link 2', url: 'http://test2.com' },
        ],
        title: 'Test Panel',
        id: 1,
        vizConfig: {
          kind: 'timeseries',
          spec: {
            fieldConfig: {
              defaults: {},
              overrides: [],
            },
            options: {},
            pluginVersion: '7.0.0',
          },
        },
      },
    },
    'panel-2': {
      kind: 'LibraryPanel',
      spec: {
        id: 2,
        title: 'Test Library Panel',
        libraryPanel: {
          uid: 'uid-for-library-panel',
          name: 'Library Panel',
        },
      },
    },
    'panel-3': {
      kind: 'Panel',
      spec: {
        data: {
          kind: 'QueryGroup',
          spec: {
            queries: [
              {
                kind: 'PanelQuery',
                spec: {
                  refId: 'A',
                  datasource: {
                    type: 'prometheus',
                    uid: 'datasource1',
                  },
                  query: {
                    kind: 'prometheus',
                    spec: {
                      expr: 'test-query',
                    },
                  },
                  hidden: false,
                },
              },
            ],
            queryOptions: {
              timeFrom: '1h',
              maxDataPoints: 100,
              timeShift: '1h',
              queryCachingTTL: 60,
              interval: '1m',
              cacheTimeout: '1m',
              hideTimeOverride: false,
            },
            transformations: [],
          },
        },
        description: 'Test Description',
        links: [],
        title: 'Test Panel 3',
        id: 3,
        vizConfig: {
          kind: 'timeseries',
          spec: {
            fieldConfig: {
              defaults: {},
              overrides: [],
            },
            options: {},
            pluginVersion: '7.0.0',
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
            element: {
              kind: 'ElementReference',
              name: 'panel-1',
            },
            height: 10,
            width: 10,
            x: 0,
            y: 0,
            repeat: {
              mode: 'variable',
              value: 'customVar',
              maxPerRow: 3,
            },
          },
        },
        {
          kind: 'GridLayoutItem',
          spec: {
            element: {
              kind: 'ElementReference',
              name: 'panel-2',
            },
            height: 10,
            width: 200,
            x: 0,
            y: 2,
          },
        },
        {
          kind: 'GridLayoutRow',
          spec: {
            y: 20,
            collapsed: false,
            title: 'Row 1',
            repeat: { value: 'customVar', mode: 'variable' },
            elements: [
              {
                kind: 'GridLayoutItem',
                spec: {
                  element: {
                    kind: 'ElementReference',
                    name: 'panel-3',
                  },
                  height: 10,
                  width: 10,
                  x: 0,
                  y: 0,
                },
              },
            ],
          },
        },
      ],
    },
  },
  links: [
    {
      asDropdown: true,
      icon: '',
      includeVars: false,
      keepTime: false,
      tags: [],
      targetBlank: false,
      title: 'Test Link',
      tooltip: '',
      type: 'dashboards',
      url: 'http://test.com',
    },
  ],

  variables: [
    {
      kind: 'QueryVariable',
      spec: {
        allValue: '*',
        current: {
          text: 'text1',
          value: 'value1',
        },
        datasource: {
          type: 'prometheus',
          uid: 'datasource1',
        },
        definition: 'definition1',
        description: 'A query variable',
        hide: 'dontHide',
        includeAll: true,
        label: 'Query Variable',
        multi: true,
        name: 'queryVar',
        options: [],
        query: {
          kind: 'prometheus',
          spec: {
            expr: 'test-query',
            refId: 'A',
          },
        },
        refresh: 'onDashboardLoad',
        regex: 'regex1',
        skipUrlSync: false,
        sort: 'disabled',
      },
    },
    {
      kind: 'CustomVariable',
      spec: {
        allValue: 'All',
        current: {
          text: 'option1',
          value: 'option1',
        },
        description: 'A custom variable',
        hide: 'dontHide',
        includeAll: true,
        label: 'Custom Variable',
        multi: true,
        name: 'customVar',
        options: [
          {
            selected: true,
            text: 'option1',
            value: 'option1',
          },
          {
            selected: false,
            text: 'option2',
            value: 'option2',
          },
        ],
        query: 'option1, option2',
        skipUrlSync: false,
      },
    },
    {
      kind: 'DatasourceVariable',
      spec: {
        current: {
          text: 'text1',
          value: 'value1',
        },
        description: 'A datasource variable',
        hide: 'dontHide',
        includeAll: false,
        label: 'Datasource Variable',
        multi: false,
        name: 'datasourceVar',
        options: [],
        pluginId: 'datasource1',
        refresh: 'onDashboardLoad',
        regex: 'regex1',
        skipUrlSync: false,
      },
    },
    {
      kind: 'ConstantVariable',
      spec: {
        current: {
          text: 'value4',
          value: 'value4',
        },
        description: 'A constant variable',
        hide: 'dontHide',
        label: 'Constant Variable',
        name: 'constantVar',
        query: 'value4',
        skipUrlSync: true,
      },
    },
    {
      kind: 'IntervalVariable',
      spec: {
        auto: false,
        auto_count: 10,
        auto_min: '1m',
        current: {
          text: '1m',
          value: '1m',
        },
        description: 'An interval variable',
        hide: 'dontHide',
        label: 'Interval Variable',
        name: 'intervalVar',
        options: [
          {
            selected: true,
            text: '1m',
            value: '1m',
          },
          {
            selected: false,
            text: '5m',
            value: '5m',
          },
          {
            selected: false,
            text: '10m',
            value: '10m',
          },
        ],
        query: '1m,5m,10m',
        refresh: 'onTimeRangeChanged',
        skipUrlSync: false,
      },
    },
    {
      kind: 'TextVariable',
      spec: {
        current: {
          text: 'value6',
          value: 'value6',
        },
        description: 'A text variable',
        hide: 'dontHide',
        label: 'Text Variable',
        name: 'textVar',
        query: 'value6',
        skipUrlSync: false,
      },
    },
    {
      kind: 'GroupByVariable',
      spec: {
        current: {
          text: 'text7',
          value: 'value7',
        },
        datasource: {
          type: 'prometheus',
          uid: 'datasource2',
        },
        description: 'A group by variable',
        hide: 'dontHide',
        label: 'Group By Variable',
        multi: false,
        name: 'groupByVar',
        options: [
          {
            text: 'option1',
            value: 'option1',
          },
          {
            text: 'option2',
            value: 'option2',
          },
        ],
        skipUrlSync: false,
      },
    },
    {
      kind: 'AdhocVariable',
      spec: {
        baseFilters: [
          {
            condition: 'AND',
            key: 'key1',
            operator: '=',
            value: 'value1',
          },
          {
            condition: 'OR',
            key: 'key2',
            operator: '=',
            value: 'value2',
          },
        ],
        datasource: {
          type: 'prometheus',
          uid: 'datasource3',
        },
        defaultKeys: [
          {
            expandable: true,
            group: 'defaultGroup1',
            text: 'defaultKey1',
            value: 'defaultKey1',
          },
        ],
        description: 'An adhoc variable',
        filters: [
          {
            condition: 'AND',
            key: 'key3',
            operator: '=',
            value: 'value3',
          },
        ],
        hide: 'dontHide',
        label: 'Adhoc Variable',
        name: 'adhocVar',
        skipUrlSync: false,
      },
    },
  ],
};
