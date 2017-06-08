define([],
  function() {
  'use strict';

  return {
    versions: function() {
      return [{
        id: 4,
        dashboardId: 1,
        parentVersion: 3,
        restoredFrom: 0,
        version: 4,
        created: '2017-02-22T17:43:01-08:00',
        createdBy: 'admin',
        message: '',
      },
      {
        id: 3,
        dashboardId: 1,
        parentVersion: 1,
        restoredFrom: 1,
        version: 3,
        created: '2017-02-22T17:43:01-08:00',
        createdBy: 'admin',
        message: '',
      },
      {
        id: 2,
        dashboardId: 1,
        parentVersion: 0,
        restoredFrom: -1,
        version: 2,
        created: '2017-02-22T17:29:52-08:00',
        createdBy: 'admin',
        message: '',
      },
      {
        id: 1,
        dashboardId: 1,
        parentVersion: 0,
        restoredFrom: -1,
        slug: 'history-dashboard',
        version: 1,
        created: '2017-02-22T17:06:37-08:00',
        createdBy: 'admin',
        message: '',
      }];
    },
    compare: function(type) {
      return type === 'basic' ? '<div></div>' : '<pre><code></code></pre>';
    },
    restore: function(version, restoredFrom) {
      return {
        dashboard: {
          meta: {
            type: 'db',
            canSave: true,
            canEdit: true,
            canStar: true,
            slug: 'history-dashboard',
            expires: '0001-01-01T00:00:00Z',
            created: '2017-02-21T18:40:45-08:00',
            updated: '2017-04-11T21:31:22.59219665-07:00',
            updatedBy: 'admin',
            createdBy: 'admin',
            version: version,
          },
          dashboard: {
            annotations: {
              list: []
            },
            description: 'A random dashboard for implementing the history list',
            editable: true,
            gnetId: null,
            graphTooltip: 0,
            hideControls: false,
            id: 1,
            links: [],
            restoredFrom: restoredFrom,
            rows: [{
                collapse: false,
                height: '250px',
                panels: [{
                  aliasColors: {},
                  bars: false,
                  datasource: null,
                  fill: 1,
                  id: 1,
                  legend: {
                    avg: false,
                    current: false,
                    max: false,
                    min: false,
                    show: true,
                    total: false,
                    values: false
                  },
                  lines: true,
                  linewidth: 1,
                  nullPointMode: "null",
                  percentage: false,
                  pointradius: 5,
                  points: false,
                  renderer: 'flot',
                  seriesOverrides: [],
                  span: 12,
                  stack: false,
                  steppedLine: false,
                  targets: [{}],
                  thresholds: [],
                  timeFrom: null,
                  timeShift: null,
                  title: 'Panel Title',
                  tooltip: {
                    shared: true,
                    sort: 0,
                    value_type: 'individual'
                  },
                  type: 'graph',
                  xaxis: {
                    mode: 'time',
                    name: null,
                    show: true,
                    values: []
                  },
                  yaxes: [{
                    format: 'short',
                    label: null,
                    logBase: 1,
                    max: null,
                    min: null,
                    show: true
                  }, {
                    format: 'short',
                    label: null,
                    logBase: 1,
                    max: null,
                    min: null,
                    show: true
                  }]
                }],
                repeat: null,
                repeatIteration: null,
                repeatRowId: null,
                showTitle: false,
                title: 'Dashboard Row',
                titleSize: 'h6'
              }
            ],
            schemaVersion: 14,
            style: 'dark',
            tags: [
              'development'
            ],
            templating: {
              'list': []
            },
            time: {
              from: 'now-6h',
              to: 'now'
            },
            timepicker: {
              refresh_intervals: [
                '5s',
                '10s',
                '30s',
                '1m',
                '5m',
                '15m',
                '30m',
                '1h',
                '2h',
                '1d',
              ],
              time_options: [
                '5m',
                '15m',
                '1h',
                '6h',
                '12h',
                '24h',
                '2d',
                '7d',
                '30d'
              ]
            },
            timezone: 'utc',
            title: 'History Dashboard',
            version: version,
          }
        },
        message: 'Dashboard restored to version ' + version,
        version: version
      };
    },
  };
});
