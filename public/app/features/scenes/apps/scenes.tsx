import React from 'react';

import { FieldColorModeId, getFrameDisplayName } from '@grafana/data';
import { locationService } from '@grafana/runtime';
import {
  SceneFlexLayout,
  SceneByFrameRepeater,
  SceneTimePicker,
  EmbeddedScene,
  SceneDataNode,
  SceneTimeRange,
  VariableValueSelectors,
  SceneQueryRunner,
  SceneControlsSpacer,
  SceneDataTransformer,
  SceneRefreshPicker,
  SceneFlexItem,
  PanelBuilders,
} from '@grafana/scenes';
import { BigValueGraphMode, BigValueTextMode, LogsDedupStrategy, LogsSortOrder } from '@grafana/schema';
import { LinkButton } from '@grafana/ui';

import { SceneRadioToggle } from './SceneRadioToggle';
import { SceneSearchBox } from './SceneSearchBox';
import { getTableFilterTransform, getTimeSeriesFilterTransform } from './transforms';
import { getInstantQuery, getLinkUrlWithAppUrlState, getTimeSeriesQuery, getVariablesDefinitions } from './utils';

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

  const httpHandlersTable = PanelBuilders.table()
    .setTitle('Handlers')
    .setData(httpHandlerQueriesFiltered)
    .setOption('footer', {
      enablePagination: true,
    })
    .setOverrides((b) =>
      b
        .matchFieldsWithNameByRegex('.*')
        .overrideFilterable(false)
        .matchFieldsWithName('Time')
        .overrideCustomFieldConfig('hidden', true)
        .matchFieldsWithName('Value')
        .overrideDisplayName('Duration (Avg)')
        .matchFieldsWithName('handler')
        .overrideLinks([
          {
            title: 'Go to handler drilldown view',
            url: '',
            onBuildUrl: () => {
              const params = locationService.getSearchObject();
              return getLinkUrlWithAppUrlState(
                '/scenes/grafana-monitoring/handlers/${__value.text:percentencode}',
                params
              );
            },
          },
        ])
    )
    .build();

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
      return new SceneFlexItem({
        key: `panel-${frameIndex}`,
        minHeight: 200,
        $data: new SceneDataNode({
          data: {
            ...data,
            series: [frame],
          },
        }),
        body: new SceneFlexLayout({
          direction: 'row',
          key: `row-${frameIndex}`,
          children: [
            new SceneFlexItem({
              key: `flex1-${frameIndex}`,
              body: PanelBuilders.timeseries()
                .setTitle(getFrameDisplayName(frame))
                .setOption('legend', { showLegend: false })
                .setHeaderActions(
                  <LinkButton
                    fill="text"
                    size="sm"
                    icon="arrow-right"
                    href={getHandlerDrilldownUrl(frame.fields[1]!.labels!.handler)}
                  >
                    Details
                  </LinkButton>
                )
                .build(),
            }),

            new SceneFlexItem({
              key: `flex2-${frameIndex}`,
              width: 200,
              body: PanelBuilders.stat()
                .setTitle('Last')
                .setOption('graphMode', BigValueGraphMode.None)
                .setOption('textMode', BigValueTextMode.Value)
                .setDisplayName('Last')
                .build(),
            }),
          ],
        }),
      });
    },
  });

  const layout = new SceneFlexLayout({
    children: [new SceneFlexItem({ body: httpHandlersTable })],
  });

  const sceneToggle = new SceneRadioToggle({
    options: [
      { value: 'table', label: 'Table' },
      { value: 'graphs', label: 'Graphs' },
    ],
    value: 'table',
    onChange: (value) => {
      if (value === 'table') {
        layout.setState({ children: [new SceneFlexItem({ body: httpHandlersTable })] });
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

function getHandlerDrilldownUrl(handler: string) {
  const params = locationService.getSearchObject();
  return getLinkUrlWithAppUrlState(`/scenes/grafana-monitoring/handlers/${encodeURIComponent(handler)}`, params);
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
        new SceneFlexItem({
          body: PanelBuilders.timeseries().setData(reqDurationTimeSeries).setTitle('Request duration avg (ms)').build(),
        }),
        new SceneFlexItem({
          body: PanelBuilders.timeseries().setData(reqCountTimeSeries).setTitle('Request count/s').build(),
        }),
      ],
    }),
  });

  return scene;
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
        new SceneFlexItem({
          height: 150,
          body: new SceneFlexLayout({
            children: [
              new SceneFlexItem({
                body: getInstantStatPanel('grafana_stat_totals_dashboard', 'Dashboards'),
              }),
              new SceneFlexItem({
                body: getInstantStatPanel('grafana_stat_total_users', 'Users'),
              }),
              new SceneFlexItem({
                body: getInstantStatPanel('sum(grafana_stat_totals_datasource)', 'Data sources'),
              }),
              new SceneFlexItem({
                body: getInstantStatPanel('grafana_stat_total_service_account_tokens', 'Service account tokens'),
              }),
            ],
          }),
        }),

        new SceneFlexItem({
          body: PanelBuilders.timeseries()
            .setData(
              new SceneQueryRunner({
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
              })
            )
            .setTitle('Memory usage')
            .setOption('legend', { showLegend: false })
            .setUnit('bytes')
            .setMin(0)
            .setCustomFieldConfig('lineWidth', 2)
            .setCustomFieldConfig('fillOpacity', 6)
            .build(),
        }),
        new SceneFlexItem({
          body: PanelBuilders.timeseries()
            .setData(
              new SceneQueryRunner({
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
              })
            )
            .setOption('legend', { showLegend: false })
            .setMin(0)
            .setCustomFieldConfig('lineWidth', 2)
            .setCustomFieldConfig('fillOpacity', 6)
            .setTitle('Go routines')
            .build(),
        }),
      ],
    }),
  });

  return scene;
}

function getInstantStatPanel(query: string, title: string) {
  return PanelBuilders.stat()
    .setData(getInstantQuery({ expr: query }))
    .setTitle(title)
    .setColor({ fixedColor: 'text', mode: FieldColorModeId.Fixed })
    .build();
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
        new SceneFlexItem({
          body: PanelBuilders.logs()
            .setData(logsQuery)
            .setTitle('')
            .setOption('showTime', true)
            .setOption('showLabels', false)
            .setOption('showCommonLabels', false)
            .setOption('wrapLogMessage', true)
            .setOption('prettifyLogMessage', false)
            .setOption('enableLogDetails', true)
            .setOption('dedupStrategy', LogsDedupStrategy.none)
            .setOption('sortOrder', LogsSortOrder.Descending)
            .build(),
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
        new SceneFlexItem({
          body: PanelBuilders.logs()
            .setTitle('')
            .setData(logsQuery)
            .setOption('showTime', true)
            .setOption('showLabels', false)
            .setOption('showCommonLabels', false)
            .setOption('wrapLogMessage', true)
            .setOption('prettifyLogMessage', false)
            .setOption('enableLogDetails', true)
            .setOption('dedupStrategy', LogsDedupStrategy.none)
            .setOption('sortOrder', LogsSortOrder.Descending)
            .build(),
        }),
      ],
    }),
  });

  return scene;
}
