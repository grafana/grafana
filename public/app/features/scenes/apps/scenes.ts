import { FieldColorModeId, getFrameDisplayName } from '@grafana/data';
import { locationService } from '@grafana/runtime';
import {
  SceneFlexLayout,
  SceneByFrameRepeater,
  SceneTimePicker,
  VizPanel,
  EmbeddedScene,
  SceneDataNode,
  SceneTimeRange,
  VariableValueSelectors,
  SceneQueryRunner,
  SceneVariableSet,
  QueryVariable,
  SceneControlsSpacer,
  SceneDataTransformer,
  SceneRefreshPicker,
} from '@grafana/scenes';
import { PromQuery } from 'app/plugins/datasource/prometheus/types';

import { SceneRadioToggle } from './SceneRadioToggle';
import { SceneSearchBox } from './SceneSearchBox';
import { getTableFilterTransform, getTimeSeriesFilterTransform } from './transforms';
import { getLinkUrlWithAppUrlState } from './utils';

export function getHttpHandlerListScene(): EmbeddedScene {
  const searchBox = new SceneSearchBox({ value: '' });

  const httpHandlerQueries = getInstantQuery({
    expr: 'sort_desc(avg without(job, instance) (rate(grafana_http_request_duration_seconds_sum[$__rate_interval]) * 1e3)) ',
  });

  const httpHandlerQueriesFiltered = new SceneDataTransformer({
    $data: httpHandlerQueries,
    transformations: [getTableFilterTransform('')],
  });

  httpHandlerQueriesFiltered.addActivationHandler(() => {
    const sub = searchBox.subscribeToState((state) => {
      // Update transform and re-process them
      httpHandlerQueriesFiltered.setState({ transformations: [getTableFilterTransform(state.value)] });
      httpHandlerQueriesFiltered.reprocessTransformations();
    });

    return () => sub.unsubscribe();
  });

  const httpHandlersTable = new VizPanel({
    $data: httpHandlerQueriesFiltered,
    pluginId: 'table',
    title: '',
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
                  onBuildUrl: () => {
                    const params = locationService.getSearchObject();
                    return getLinkUrlWithAppUrlState(
                      '/scenes/grafana-monitoring/handlers/${__value.text:percentencode}',
                      params
                    );
                  },
                },
              ],
            },
          ],
        },
      ],
    },
  });

  const reqDurationTimeSeries = new SceneQueryRunner({
    datasource: { uid: 'gdev-prometheus' },
    queries: [
      {
        refId: 'A',
        //expr: ``,
        expr: 'topk(20, avg without(job, instance) (rate(grafana_http_request_duration_seconds_sum[$__rate_interval])) * 1e3)',
        range: true,
        format: 'time_series',
        legendFormat: '{{method}} {{handler}} (status = {{status_code}})',
        maxDataPoints: 500,
      },
    ],
  });

  const reqDurationTimeSeriesFiltered = new SceneDataTransformer({
    $data: reqDurationTimeSeries,
    transformations: [getTimeSeriesFilterTransform('')],
  });

  reqDurationTimeSeriesFiltered.addActivationHandler(() => {
    const sub = searchBox.subscribeToState((state) => {
      // Update transform and re-process them
      reqDurationTimeSeriesFiltered.setState({ transformations: [getTimeSeriesFilterTransform(state.value)] });
      reqDurationTimeSeriesFiltered.reprocessTransformations();
    });

    return () => sub.unsubscribe();
  });

  const graphsScene = new SceneByFrameRepeater({
    $data: reqDurationTimeSeriesFiltered,
    body: new SceneFlexLayout({
      direction: 'column',
      children: [],
    }),
    getLayoutChild: (data, frame, frameIndex) => {
      return new SceneFlexLayout({
        key: `panel-${frameIndex}`,
        direction: 'row',
        placement: { minHeight: 200 },
        $data: new SceneDataNode({
          data: {
            ...data,
            series: [frame],
          },
        }),
        children: [
          new VizPanel({
            pluginId: 'timeseries',
            // titleLink: {
            //   path: `/scenes/grafana-monitoring/handlers/${encodeURIComponent(frame.fields[1].labels.handler)}`,
            //   queryKeys: ['from', 'to', 'var-instance'],
            // },
            title: getFrameDisplayName(frame),
            options: {
              legend: { displayMode: 'hidden' },
            },
          }),
          new VizPanel({
            placement: { width: 200 },
            title: 'Last',
            pluginId: 'stat',
            fieldConfig: {
              defaults: {
                displayName: 'Last',
                links: [
                  {
                    title: 'Go to handler drilldown view',
                    url: ``,
                    onBuildUrl: () => {
                      const params = locationService.getSearchObject();
                      return getLinkUrlWithAppUrlState(
                        '/scenes/grafana-monitoring/handlers/${__field.labels.handler:percentencode}',
                        params
                      );
                    },
                  },
                ],
              },
              overrides: [],
            },
            options: {
              graphMode: 'none',
              textMode: 'value',
            },
          }),
        ],
      });
    },
  });

  const layout = new SceneFlexLayout({
    children: [httpHandlersTable],
  });

  const sceneToggle = new SceneRadioToggle({
    options: [
      { value: 'table', label: 'Table' },
      { value: 'graphs', label: 'Graphs' },
    ],
    value: 'table',
    onChange: (value) => {
      if (value === 'table') {
        layout.setState({ children: [httpHandlersTable] });
      } else {
        layout.setState({ children: [graphsScene] });
      }
    },
  });

  const scene = new EmbeddedScene({
    $variables: getVariablesDefinitions(),
    $data: httpHandlerQueries,
    $timeRange: new SceneTimeRange({ from: 'now-1h', to: 'now' }),
    controls: [
      new VariableValueSelectors({}),
      searchBox,
      new SceneControlsSpacer(),
      sceneToggle,
      new SceneTimePicker({ isOnCanvas: true }),
      new SceneRefreshPicker({ isOnCanvas: true }),
    ],
    body: layout,
  });

  return scene;
}

export function getHandlerDetailsScene(handler: string): EmbeddedScene {
  const reqDurationTimeSeries = getTimeSeriesQuery({
    expr: `avg without(job, instance) (rate(grafana_http_request_duration_seconds_sum{handler="${handler}"}[$__rate_interval])) * 1e3`,
    legendFormat: '{{method}} {{handler}} (status = {{status_code}})',
  });

  const reqCountTimeSeries = getTimeSeriesQuery({
    expr: `sum without(job, instance) (rate(grafana_http_request_duration_seconds_count{handler="${handler}"}[$__rate_interval])) `,
    legendFormat: '{{method}} {{handler}} (status = {{status_code}})',
  });

  const scene = new EmbeddedScene({
    $variables: getVariablesDefinitions(),
    $timeRange: new SceneTimeRange({ from: 'now-1h', to: 'now' }),
    controls: [
      new VariableValueSelectors({}),
      new SceneControlsSpacer(),
      new SceneTimePicker({ isOnCanvas: true }),
      new SceneRefreshPicker({ isOnCanvas: true }),
    ],
    body: new SceneFlexLayout({
      direction: 'column',
      children: [
        new VizPanel({
          $data: reqDurationTimeSeries,
          pluginId: 'timeseries',
          title: 'Request duration avg (ms)',
          placement: {},
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

  return scene;
}

function getInstantQuery(query: Partial<PromQuery>): SceneQueryRunner {
  return new SceneQueryRunner({
    datasource: { uid: 'gdev-prometheus' },
    queries: [
      {
        refId: 'A',
        instant: true,
        format: 'table',
        maxDataPoints: 500,
        ...query,
      },
    ],
  });
}

function getTimeSeriesQuery(query: Partial<PromQuery>): SceneQueryRunner {
  return new SceneQueryRunner({
    datasource: { uid: 'gdev-prometheus' },
    queries: [
      {
        refId: 'A',
        range: true,
        format: 'time_series',
        maxDataPoints: 500,
        ...query,
      },
    ],
  });
}

export function getOverviewScene(): EmbeddedScene {
  const scene = new EmbeddedScene({
    $variables: getVariablesDefinitions(),
    $timeRange: new SceneTimeRange({ from: 'now-1h', to: 'now' }),
    controls: [
      new VariableValueSelectors({}),
      new SceneControlsSpacer(),
      new SceneTimePicker({ isOnCanvas: true }),
      new SceneRefreshPicker({ isOnCanvas: true }),
    ],
    body: new SceneFlexLayout({
      direction: 'column',
      children: [
        new SceneFlexLayout({
          placement: { height: 150 },
          children: [
            getInstantStatPanel('grafana_stat_totals_dashboard', 'Dashboards'),
            getInstantStatPanel('grafana_stat_total_users', 'Users'),
            getInstantStatPanel('sum(grafana_stat_totals_datasource)', 'Data sources'),
            getInstantStatPanel('grafana_stat_total_service_account_tokens', 'Service account tokens'),
          ],
        }),
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

function getInstantStatPanel(query: string, title: string) {
  return new VizPanel({
    $data: getInstantQuery({ expr: query }),
    pluginId: 'stat',
    title,
    options: {},
    fieldConfig: {
      defaults: {
        color: { fixedColor: 'text', mode: FieldColorModeId.Fixed },
      },
      overrides: [],
    },
  });
}

export function getHandlerLogsScene(handler: string): EmbeddedScene {
  const logsQuery = new SceneQueryRunner({
    datasource: { uid: 'gdev-loki' },
    queries: [
      {
        refId: 'A',
        expr: `{job="grafana"} | logfmt | handler=\`${handler}\` | __error__=\`\``,
        queryType: 'range',
        maxDataPoints: 5000,
      },
    ],
  });

  const scene = new EmbeddedScene({
    $variables: getVariablesDefinitions(),
    $timeRange: new SceneTimeRange({ from: 'now-1h', to: 'now' }),
    controls: [
      new VariableValueSelectors({}),
      new SceneControlsSpacer(),
      new SceneTimePicker({ isOnCanvas: true }),
      new SceneRefreshPicker({ isOnCanvas: true }),
    ],
    body: new SceneFlexLayout({
      direction: 'column',
      children: [
        new VizPanel({
          pluginId: 'text',
          title: '',
          options: {
            mode: 'markdown',
            content: `
[mupp](/scenes/grafana-monitoring/handlers/${encodeURIComponent(handler)}/logs/mupp)
[mapp](/scenes/grafana-monitoring/handlers/${encodeURIComponent(handler)}/logs/mapp)
`,
          },
        }),
        new VizPanel({
          $data: logsQuery,
          pluginId: 'logs',
          title: '',
          options: {
            showTime: true,
            showLabels: false,
            showCommonLabels: false,
            wrapLogMessage: true,
            prettifyLogMessage: false,
            enableLogDetails: true,
            dedupStrategy: 'none',
            sortOrder: 'Descending',
          },
        }),
      ],
    }),
  });

  return scene;
}

export function getOverviewLogsScene(): EmbeddedScene {
  const logsQuery = new SceneQueryRunner({
    datasource: { uid: 'gdev-loki' },
    queries: [
      {
        refId: 'A',
        expr: `{job="grafana"} | logfmt | __error__=\`\``,
        queryType: 'range',
        maxDataPoints: 5000,
      },
    ],
  });

  const scene = new EmbeddedScene({
    $variables: getVariablesDefinitions(),
    $timeRange: new SceneTimeRange({ from: 'now-1h', to: 'now' }),
    controls: [
      new VariableValueSelectors({}),
      new SceneControlsSpacer(),
      new SceneTimePicker({ isOnCanvas: true }),
      new SceneRefreshPicker({ isOnCanvas: true }),
    ],
    body: new SceneFlexLayout({
      direction: 'column',
      children: [
        new VizPanel({
          $data: logsQuery,
          pluginId: 'logs',
          title: '',
          options: {
            showTime: true,
            showLabels: false,
            showCommonLabels: false,
            wrapLogMessage: true,
            prettifyLogMessage: false,
            enableLogDetails: true,
            dedupStrategy: 'none',
            sortOrder: 'Descending',
          },
        }),
      ],
    }),
  });

  return scene;
}
