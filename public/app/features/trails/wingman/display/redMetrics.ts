import { RawTimeRange } from '@grafana/data';
import { getPrometheusTime } from '@grafana/prometheus/src/language_utils';
import { getBackendSrv } from '@grafana/runtime';
import { PanelBuilders, SceneCSSGridItem, SceneCSSGridLayout, sceneGraph, SceneQueryRunner, VizPanel } from '@grafana/scenes';
import { SortOrder } from '@grafana/schema';
import { TooltipDisplayMode } from '@grafana/ui';
import { HeatmapColorMode } from 'app/plugins/panel/heatmap/types';

import { DataTrail } from '../../DataTrail';
import { MDP_METRIC_PREVIEW, trailDS, VAR_DATASOURCE_EXPR } from '../../shared';

/**
 * This is an object that represents a collection of RED metrics
 */
type RedObject = {
  job: string;
  rate: string;
  error: string;
  duration: string;
};

/**
 * WIP
 * [x] group by job
 * [x] use traces to metrics
 * [x] use approppriate queries
 * [x] build panels
 * [x] 3 panels per row
 * [x] add __ignore_usage__="" to each query
 * [x] header with group
 * [x] color for each r, e, or d
 * [x] visualizations for each r, e, or d
 * [x] x axis filtering
 * [x] add padding between groups
 * [x] make header background transparent
 * [x] don't show grouping options in wingman when selecting red metrics
 * [ ] add adhoc filters to queries
 * [ ] identify extra metrics associated with RED metrics
 * @param trail 
 * @returns grouped panels for red metrics based on job
 */
export const renderAsRedMetricsDisplay = async (trail: DataTrail, height: string): Promise<SceneCSSGridLayout[]> => {
  // use this file for red metrics display code
  // return children as in red metrics display
  // I think we can return SceneFlexLayout in SceneFlexItem so it will also display rows

  // 1. Loop over job label values
  // for each job label
  // identify the RED metrics from traces to metrics, the span metrics
  // create three panels for each, a Rate, Error, Duration
  const filters = [{
    key: '__name__', value: 'traces_spanmetrics_latency_.*', operator: '=~',
  }];

  // const jobValues = await trail.datasourceHelper.getTagValues({key: 'job', filters});

  const datasourceUid = sceneGraph.interpolate(trail, VAR_DATASOURCE_EXPR);
  const timeRange: RawTimeRange | undefined = trail.state.$timeRange?.state;
  if (!timeRange) {
    return [];
  }
  const start = getPrometheusTime(timeRange.from, false);
  const end = getPrometheusTime(timeRange.to, true);

  const jobValsUrl = `/api/datasources/uid/${datasourceUid}/resources/api/v1/label/job/values`;
  const params: Record<string, string | number> = {
    start,
    end,
    'match[]': '{__name__="traces_spanmetrics_latency_count",span_kind=~"SPAN_KIND_SERVER|SPAN_KIND_CONSUMER",status_code="STATUS_CODE_ERROR"}',
  };

  const response = await getBackendSrv().get(
    jobValsUrl,
    params,
    'explore-metrics-red-metrics-traces-to-metrics-jobs'
  );

  const jobValues = response.data;

  // const queryUrl = `/api/datasources/uid/${datasourceUid}/resources/api/v1/query`;
  // const paramsTotalTargets: Record<string, string | number> = {
  //   start,
  //   end,
  //   query,
  // };



  // const responseTotal = await getBackendSrv().get<OtelResponse>(
  //   url,
  //   paramsTotalTargets,
  //   `explore-metrics-otel-check-total-${query}`
  // );
  
  // 2. identify the metrics and query
  // what will each query look like?
  // note remove cluster but add for interpolated filters
  // Rate: 
    // metric: traces_spanmetrics_latency_count
    // App o11y example query: sum(rate(traces_spanmetrics_latency_count{span_kind=~"SPAN_KIND_SERVER|SPAN_KIND_CONSUMER", job="o11y-apps-platform/apiserver", cluster=~"prod-ap-northeast-0"} [$__rate_interval])) by (job)
  // Error: 
    // metric: traces_spanmetrics_latency_count
    // App o11y example query: (sum(rate(traces_spanmetrics_latency_count{span_kind=~"SPAN_KIND_SERVER|SPAN_KIND_CONSUMER", job="o11y-apps-platform/apiserver", cluster=~"prod-ap-northeast-0", status_code="STATUS_CODE_ERROR"} [$__rate_interval])) by (job) OR sum(rate(traces_spanmetrics_latency_count{span_kind=~"SPAN_KIND_SERVER|SPAN_KIND_CONSUMER", job="o11y-apps-platform/apiserver", cluster=~"prod-ap-northeast-0"} [$__rate_interval])) by (job) * 0) / sum(rate(traces_spanmetrics_latency_count{span_kind=~"SPAN_KIND_SERVER|SPAN_KIND_CONSUMER", job="o11y-apps-platform/apiserver", cluster=~"prod-ap-northeast-0"} [$__rate_interval])) by (job)
  // Duration: 
    // metric: traces_spanmetrics_latency_bucket
    // App o11y example query: histogram_quantile(0.95, sum(rate(traces_spanmetrics_latency_bucket{span_kind=~"SPAN_KIND_SERVER|SPAN_KIND_CONSUMER", job="o11y-apps-platform/apiserver", cluster=~"prod-ap-northeast-0"} [$__rate_interval])) by (le,job))

  // group the queries by job
  // *** convert filters to interpolated filters here
  const redQueriesByJob: RedObject[] = [];

  for (const job of jobValues) {
    const queries = {
      job: ''+job,
      rate: `sum(rate(traces_spanmetrics_latency_count{span_kind=~"SPAN_KIND_SERVER|SPAN_KIND_CONSUMER", job="${job}", __ignore_usage__=""} [$__rate_interval])) by (job)`,
      error: `((sum(rate(traces_spanmetrics_latency_count{span_kind=~"SPAN_KIND_SERVER|SPAN_KIND_CONSUMER", job="${job}", __ignore_usage__="", status_code="STATUS_CODE_ERROR"} [$__rate_interval])) by (job) OR sum(rate(traces_spanmetrics_latency_count{span_kind=~"SPAN_KIND_SERVER|SPAN_KIND_CONSUMER", job="${job}", __ignore_usage__=""} [$__rate_interval])) by (job) * 0) / sum(rate(traces_spanmetrics_latency_count{span_kind=~"SPAN_KIND_SERVER|SPAN_KIND_CONSUMER", job="${job}", __ignore_usage__=""} [$__rate_interval])) by (job)) * 100`,
      duration: `sum by (le) (rate(traces_spanmetrics_latency_bucket{span_kind=~"SPAN_KIND_SERVER|SPAN_KIND_CONSUMER", job="${job}", __ignore_usage__=""} [$__rate_interval]))`,
    }
    redQueriesByJob.push(queries);
  }
  // [x] add __ignore_usage__="" to each query
  const children:  SceneCSSGridLayout[] = [];

  // 3. Create the children panels grouped in 3
  redQueriesByJob.forEach((query, index) => {
    const header = panelHeader(query.job);
    const rt = redPanelItem(query, 'rate', index);
    const et = redPanelItem(query, 'error', index);
    const dt = redPanelItem(query, 'duration', index);
    
    // make two grid layouts to handle the column amounts
    const row = new SceneCSSGridLayout({
      children: [rt,et,dt],
      templateColumns: 'repeat(3, minmax(0, 1fr))',
      autoRows: height,
      isLazy: true,
    })

    const headerRow = new SceneCSSGridLayout({
      children: [header],
      templateColumns: '1/-1',
      autoRows: '30px',      
    });

    // make one full row to add space between groups
    const fullRow = new SceneCSSGridLayout({
      children: [headerRow, row],
      templateColumns: '1/-1',
      autoRows: 'auto',
      rowGap: .5,
    });

    children.push(fullRow);
  });

  return children;
};

/**
 * Creates a panel with a viz based on red type (rate, error, or duration)
 * @param query 
 * @param red 
 * @param index 
 * @returns 
 */
function redPanelItem(query: RedObject, red: 'rate'|'error'|'duration', index: number) {
  const redQuery = query[red];

  let panel: VizPanel;

  switch (red) {
    case 'rate':
      panel = ratePanel(red);
      break;
    case 'error':
      panel = errorPanel(red);
      break;
    case 'duration':
      panel = durationPanel(red);
      break;
    default:
      panel = PanelBuilders.barchart().build();
  }
  return new SceneCSSGridItem({
    gridColumn: 'span 3',
    // $behaviors: [hideEmptyPreviews('')],
    $data: new SceneQueryRunner({
      datasource: trailDS,
      maxDataPoints: red === 'error' ? 100 : MDP_METRIC_PREVIEW,
      queries: [
        {
          refId: `${query.job}-rate`,
          expr: redQuery,
          format: red === 'duration' ? 'heatmap' : 'timeseries',
          legendFormat: `${query.job} ${red}`
        }
      ],
    }),
    body: panel,
  });
}

function panelHeader(job: string) {
  return new SceneCSSGridItem({
    gridColumn: '1/-1',
    body: PanelBuilders.text()
      .setTitle(`Job: ${job}`)
      .setOption('content', '')
      .setDisplayMode('transparent')
      .build()
  });
}

/**
 * rate time series panel
 */
function ratePanel(red: string) {
  return PanelBuilders.timeseries()
    .setDescription('Rate of requests per second.')
    .setTitle(`${red.toLocaleUpperCase()}`)
    .setUnit('req/s')
    .setOption('legend', { showLegend: false })
    .setOption('tooltip', { mode: TooltipDisplayMode.Multi, sort: SortOrder.Descending })
    .setCustomFieldConfig('fillOpacity', 9)
    .setColor({ mode: 'fixed', fixedColor: 'green' })
    // .setDescription(description)
    // .setHeaderActions([
    //   new SelectMetricAction({ metric, title: 'Select' }),
    //   new AddToExplorationButton({ labelName: metric }),
    // ])
    .build();
}

/**
 * error bar chart panel
 */
function errorPanel(red: string) {
  return PanelBuilders.barchart()
    .setDescription('Percentage of requests that resulted in an error over all requests.')
    .setTitle(`${red.toLocaleUpperCase()}`)
    .setUnit('%')
    .setOption('legend', { showLegend: false })
    .setOption('tooltip', { mode: TooltipDisplayMode.Multi, sort: SortOrder.Descending })
    .setMin(0)
    .setMax(100)
    .setCustomFieldConfig('fillOpacity', 9)
    .setOption('xTickLabelSpacing', 100)
    .setColor({ mode: 'fixed', fixedColor: 'red' })
    // .setDescription(description)
    // .setHeaderActions([
    //   new SelectMetricAction({ metric, title: 'Select' }),
    //   new AddToExplorationButton({ labelName: metric }),
    // ])
    .build();
}

/**
 * duration histogram panel
 */
function durationPanel(red: string) {
  return PanelBuilders.heatmap() 
    .setDescription('Distribution of request durations over time.')
    .setTitle(`${red.toLocaleUpperCase()}`)
    .setUnit('ms')
    .setOption('calculate', false)
    .setOption('color', {
      mode: HeatmapColorMode.Scheme,
      exponent: 0.5,
      scheme: 'Spectral',
      steps: 32,
      reverse: false,
    })
    .build();
}

/**
 * WIP need to create a new previewCache to sort and filter by job values
 * @returns 
 */
export function hideEmptyRedPreviews() {
  return (gridItem: SceneCSSGridItem) => {
    const data = sceneGraph.getData(gridItem);
    if (!data) {
      return;
    }
  }
}
