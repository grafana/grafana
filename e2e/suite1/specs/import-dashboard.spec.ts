import { e2e } from '@grafana/e2e';

e2e.scenario({
  describeName: 'Import Dashboard Test',
  itName: 'Ensure you can import a dashboard',
  addScenarioDataSource: false,
  addScenarioDashBoard: false,
  skipScenario: false,
  scenario: () => {
    e2e.flows.importDashboard(TEST_DASHBOARD);
  },
});

const TEST_DASHBOARD = {
  annotations: {
    list: [
      {
        builtIn: 1,
        datasource: '-- Grafana --',
        enable: true,
        hide: true,
        iconColor: 'rgba(0, 211, 255, 1)',
        name: 'Annotations & Alerts',
        type: 'dashboard',
      },
    ],
  },
  editable: true,
  gnetId: null,
  graphTooltip: 0,
  id: 74,
  links: [],
  panels: [
    {
      datasource: null,
      fieldConfig: {
        defaults: {
          color: {
            mode: 'palette-classic',
          },
          custom: {
            axisLabel: '',
            axisPlacement: 'auto',
            barAlignment: 0,
            drawStyle: 'line',
            fillOpacity: 0,
            gradientMode: 'none',
            hideFrom: {
              legend: false,
              tooltip: false,
              viz: false,
            },
            lineInterpolation: 'linear',
            lineWidth: 1,
            pointSize: 5,
            scaleDistribution: {
              type: 'linear',
            },
            showPoints: 'auto',
            spanNulls: false,
            stacking: {
              group: 'A',
              mode: 'none',
            },
            thresholdsStyle: {
              mode: 'off',
            },
          },
          mappings: [],
          thresholds: {
            mode: 'absolute',
            steps: [
              {
                color: 'green',
                value: null,
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
      gridPos: {
        h: 9,
        w: 12,
        x: 0,
        y: 0,
      },
      id: 2,
      options: {
        legend: {
          calcs: [],
          displayMode: 'list',
          placement: 'bottom',
        },
        tooltip: {
          mode: 'single',
        },
      },
      title: 'Panel Title',
      type: 'timeseries',
    },
  ],
  schemaVersion: 30,
  style: 'dark',
  tags: [],
  templating: {
    list: [],
  },
  time: {
    from: '2021-06-30T04:00:00.000Z',
    to: '2021-07-02T03:59:59.000Z',
  },
  timepicker: {},
  timezone: '',
  title: 'An imported dashboard for e2e tests',
  uid: '6V0Nzyz7k',
  version: 1,
};
