import { SceneFlexLayout, SceneSubMenu, SceneTimePicker, VizPanel } from '../components';
import { EmbeddedScene } from '../components/Scene';
import { SceneTimeRange } from '../core/SceneTimeRange';
import { SceneQueryRunner } from '../querying/SceneQueryRunner';
import { VariableValueSelectors } from '../variables/components/VariableValueSelectors';
import { SceneVariableSet } from '../variables/sets/SceneVariableSet';
import { QueryVariable } from '../variables/variants/query/QueryVariable';

let scene: EmbeddedScene | undefined;
let handlerScenes: Map<string, EmbeddedScene> = new Map();

export function getTopLevelScene() {
  if (scene) {
    return scene;
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

  const variables = new SceneVariableSet({
    variables: [
      new QueryVariable({
        name: 'instance',
        datasource: { uid: 'gdev-prometheus' },
        query: { query: 'label_values(grafana_http_request_duration_seconds_sum, instance)' },
      }),
    ],
  });

  scene = new EmbeddedScene({
    title: 'Grafana Monitoring',
    $variables: variables,
    $timeRange: new SceneTimeRange({ from: 'now-1h', to: 'now' }),
    subMenu: new SceneSubMenu({
      children: [new VariableValueSelectors({}), new SceneTimePicker({ isOnCanvas: true })],
    }),
    layout: new SceneFlexLayout({
      children: [
        new VizPanel({
          $data: httpHandlerQueries,
          pluginId: 'table',
          title: 'HTTP request handlers',
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
        }),
      ],
    }),
  });

  return scene;
}

export function getHandlerScene(handler: string): EmbeddedScene {
  if (handlerScenes.has(handler)) {
    return handlerScenes.get(handler)!;
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
    $timeRange: new SceneTimeRange({ from: 'now-1h', to: 'now' }),
    subMenu: new SceneSubMenu({
      children: [new VariableValueSelectors({}), new SceneTimePicker({ isOnCanvas: true })],
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
          title: 'Request count',
          //displayMode: 'transparent',
          options: {},
        }),
      ],
    }),
  });

  handlerScenes.set(handler, scene);

  return scene;
}
