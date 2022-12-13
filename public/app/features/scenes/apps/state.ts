import { SceneFlexLayout, SceneSubMenu, SceneTimePicker, VizPanel } from '../components';
import { EmbeddedScene } from '../components/Scene';
import { SceneSubMenuSpacer } from '../components/SceneSubMenu';
import { SceneTimeRange } from '../core/SceneTimeRange';
import { SceneQueryRunner } from '../querying/SceneQueryRunner';
import { VariableValueSelectors } from '../variables/components/VariableValueSelectors';
import { SceneVariableSet } from '../variables/sets/SceneVariableSet';
import { QueryVariable } from '../variables/variants/query/QueryVariable';

import { SceneConditional } from './SceneConditional';
import { SceneRadioToggle } from './SceneRadioToggle';

let sceneCache: Map<string, EmbeddedScene> = new Map();

export function getHttpHandlerListScene(): EmbeddedScene {
  const sceneKey = 'handler level';

  if (sceneCache.has(sceneKey)) {
    return sceneCache.get(sceneKey)!;
  }

  const httpHandlerQueries = new SceneQueryRunner({
    datasource: { uid: 'gdev-prometheus' },
    queries: [
      {
        refId: 'A',
        expr: 'sort_desc(avg without(job, instance) (rate(grafana_http_request_duration_seconds_sum[$__rate_interval]) * 1e3))',
        instant: true,
        format: 'table',
      },
    ],
  });

  const sceneToggle = new SceneRadioToggle({
    options: [
      { value: 'table', label: 'Table' },
      { value: 'graphs', label: 'Graphs' },
    ],
    value: 'table',
  });

  const httpHandlersTable = new VizPanel({
    $data: httpHandlerQueries,
    pluginId: 'table',
    title: '',
    displayMode: 'transparent',
    options: {
      footer: {
        enablePagination: true,
      },
    },
    fieldConfig: {
      defaults: {},
      overrides: [
        {
          matcher: {
            id: 'byRegexp',
            options: '.*',
          },
          properties: [{ id: 'filterable', value: false }],
        },
        {
          matcher: {
            id: 'byName',
            options: 'Time',
          },
          properties: [{ id: 'custom.hidden', value: true }],
        },
        {
          matcher: {
            id: 'byName',
            options: 'Value',
          },
          properties: [{ id: 'displayName', value: 'Duration (Avg)' }],
        },
        {
          matcher: {
            id: 'byName',
            options: 'handler',
          },
          properties: [
            {
              id: 'links',
              value: [
                {
                  title: 'Go to handler drilldown view',
                  url: '/scenes/grafana-monitoring/handlers/${__value.text:percentencode}',
                },
              ],
            },
          ],
        },
      ],
    },
  });

  const scene = new EmbeddedScene({
    title: 'Grafana Monitoring',
    $variables: getVariablesDefinitions(),
    $timeRange: new SceneTimeRange({ from: 'now-1h', to: 'now' }),
    subMenu: new SceneSubMenu({
      children: [
        new VariableValueSelectors({}),
        new SceneSubMenuSpacer(),
        sceneToggle,
        new SceneTimePicker({ isOnCanvas: true }),
      ],
    }),
    layout: new SceneFlexLayout({
      children: [httpHandlersTable, getHttpHandlersGraphsScene()],
    }),
  });

  sceneCache.set(sceneKey, scene);
  return scene;
}

export function getHttpHandlersGraphsScene() {
  const reqDurationTimeSeries = new SceneQueryRunner({
    datasource: { uid: 'gdev-prometheus' },
    queries: [
      {
        refId: 'A',
        expr: `avg without(job, instance) (rate(grafana_http_request_duration_seconds_sum[$__rate_interval])) * 1e3`,
        range: true,
        format: 'time_series',
        legendFormat: '{{method}} {{handler}} (status = {{status_code}})',
        maxDataPoints: 500,
      },
    ],
  });

  const graph = new VizPanel({
    $data: reqDurationTimeSeries,
    pluginId: 'timeseries',
    title: 'Request duration avg (ms)',
    size: {},
    options: {},
  });

  return graph;
}

export function getHandlerScene(handler: string): EmbeddedScene {
  const sceneKey = `handler ${handler}`;

  if (sceneCache.has(sceneKey)) {
    return sceneCache.get(sceneKey)!;
  }

  const reqDurationTimeSeries = new SceneQueryRunner({
    datasource: { uid: 'gdev-prometheus' },
    queries: [
      {
        refId: 'A',
        expr: `avg without(job, instance) (rate(grafana_http_request_duration_seconds_sum{handler="${handler}"}[$__rate_interval])) * 1e3`,
        range: true,
        format: 'time_series',
        legendFormat: '{{method}} {{handler}} (status = {{status_code}})',
        maxDataPoints: 500,
      },
    ],
  });

  const reqCountTimeSeries = new SceneQueryRunner({
    datasource: { uid: 'gdev-prometheus' },
    queries: [
      {
        refId: 'A',
        expr: `sum without(job, instance) (rate(grafana_http_request_duration_seconds_count{handler="${handler}"}[$__rate_interval])) `,
        range: true,
        format: 'time_series',
        legendFormat: '{{method}} {{handler}} (status = {{status_code}})',
        maxDataPoints: 500,
      },
    ],
  });

  const scene = new EmbeddedScene({
    title: `Http handler: ${handler}`,
    $variables: getVariablesDefinitions(),
    $timeRange: new SceneTimeRange({ from: 'now-1h', to: 'now' }),
    subMenu: new SceneSubMenu({
      children: [new VariableValueSelectors({}), new SceneSubMenuSpacer(), new SceneTimePicker({ isOnCanvas: true })],
    }),
    layout: new SceneFlexLayout({
      direction: 'column',
      children: [
        new VizPanel({
          $data: reqDurationTimeSeries,
          pluginId: 'timeseries',
          title: 'Request duration avg (ms)',
          size: {},
          //displayMode: 'transparent',
          options: {},
        }),
        new VizPanel({
          $data: reqCountTimeSeries,
          pluginId: 'timeseries',
          title: 'Request count/s',
          //displayMode: 'transparent',
          options: {},
        }),
      ],
    }),
  });

  sceneCache.set(sceneKey, scene);
  return scene;
}

export function getOverviewScene(): EmbeddedScene {
  const sceneKey = 'overview';

  if (sceneCache.has(sceneKey)) {
    return sceneCache.get(sceneKey)!;
  }

  const scene = new EmbeddedScene({
    title: '',
    $variables: getVariablesDefinitions(),
    $timeRange: new SceneTimeRange({ from: 'now-1h', to: 'now' }),
    subMenu: new SceneSubMenu({
      children: [new VariableValueSelectors({}), new SceneSubMenuSpacer(), new SceneTimePicker({ isOnCanvas: true })],
    }),
    layout: new SceneFlexLayout({
      direction: 'column',
      children: [
        new VizPanel({
          $data: new SceneQueryRunner({
            datasource: { uid: 'gdev-prometheus' },
            queries: [
              {
                refId: 'A',
                expr: `sum(process_resident_memory_bytes{job="grafana", instance=~"$instance"})`,
                range: true,
                format: 'time_series',
                maxDataPoints: 500,
              },
            ],
          }),
          pluginId: 'timeseries',
          title: 'Memory usage',
          size: {},
          options: {
            legend: {
              showLegend: false,
            },
          },
          fieldConfig: {
            defaults: {
              unit: 'bytes',
              min: 0,
              custom: {
                lineWidth: 2,
                fillOpacity: 6,
                //gradientMode: 'opacity',
              },
            },
            overrides: [],
          },
        }),
        new VizPanel({
          $data: new SceneQueryRunner({
            datasource: { uid: 'gdev-prometheus' },
            queries: [
              {
                refId: 'A',
                expr: `sum(go_goroutines{job="grafana", instance=~"$instance"})`,
                range: true,
                format: 'time_series',
                maxDataPoints: 500,
              },
            ],
          }),
          pluginId: 'timeseries',
          title: 'Go routines',
          size: {},
          options: {
            legend: {
              showLegend: false,
            },
          },
          fieldConfig: {
            defaults: {
              min: 0,
              custom: {
                lineWidth: 2,
                fillOpacity: 6,
                //gradientMode: 'opacity',
              },
            },
            overrides: [],
          },
        }),
      ],
    }),
  });

  sceneCache.set(sceneKey, scene);
  return scene;
}

function getVariablesDefinitions() {
  return new SceneVariableSet({
    variables: [
      new QueryVariable({
        name: 'instance',
        datasource: { uid: 'gdev-prometheus' },
        query: { query: 'label_values(grafana_http_request_duration_seconds_sum, instance)' },
      }),
    ],
  });
}
