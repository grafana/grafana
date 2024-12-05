import { PanelBuilders, SceneCSSGridItem, SceneCSSGridLayout, sceneGraph, SceneQueryRunner } from '@grafana/scenes';
import { SortOrder } from '@grafana/schema';
import { TooltipDisplayMode } from '@grafana/ui';

import { DataTrail } from '../../DataTrail';
import { MDP_METRIC_PREVIEW, trailDS } from '../../shared';
import { getColorByIndex } from '../../utils';

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
 * [ ] header with group
 * [ ] color
 * [ ] visualizations
 * [ ] x axis filtering
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

  const jobValues = await trail.datasourceHelper.getTagValues({key: 'job', filters});
  
  // 2. identify the metrics and query
  // what will each query look like?
  // note remove cluster but add for interpolated filters
  // Rate: 
    // metric: traces_spanmetrics_latency_count
    // sum(rate(traces_spanmetrics_latency_count{span_kind=~"SPAN_KIND_SERVER|SPAN_KIND_CONSUMER", job="o11y-apps-platform/apiserver", cluster=~"prod-ap-northeast-0"} [$__rate_interval])) by (job)
  // Error: 
    // metric: traces_spanmetrics_latency_count
    // query: (sum(rate(traces_spanmetrics_latency_count{span_kind=~"SPAN_KIND_SERVER|SPAN_KIND_CONSUMER", job="o11y-apps-platform/apiserver", cluster=~"prod-ap-northeast-0", status_code="STATUS_CODE_ERROR"} [$__rate_interval])) by (job) OR sum(rate(traces_spanmetrics_latency_count{span_kind=~"SPAN_KIND_SERVER|SPAN_KIND_CONSUMER", job="o11y-apps-platform/apiserver", cluster=~"prod-ap-northeast-0"} [$__rate_interval])) by (job) * 0) / sum(rate(traces_spanmetrics_latency_count{span_kind=~"SPAN_KIND_SERVER|SPAN_KIND_CONSUMER", job="o11y-apps-platform/apiserver", cluster=~"prod-ap-northeast-0"} [$__rate_interval])) by (job)
  // Duration: 
    // metric: traces_spanmetrics_latency_bucket
    // query: histogram_quantile(0.95, sum(rate(traces_spanmetrics_latency_bucket{span_kind=~"SPAN_KIND_SERVER|SPAN_KIND_CONSUMER", job="o11y-apps-platform/apiserver", cluster=~"prod-ap-northeast-0"} [$__rate_interval])) by (le,job))

  // group the queries by job
  // *** convert filters to interpolated filters here
  const redQueriesByJob: RedObject[] = [];

  for (const job of jobValues) {
    const queries = {
      job: ''+job.text,
      rate: `sum(rate(traces_spanmetrics_latency_count{span_kind=~"SPAN_KIND_SERVER|SPAN_KIND_CONSUMER", job="${job.value}", __ignore_usage__=""} [$__rate_interval])) by (job)`,
      error: `(sum(rate(traces_spanmetrics_latency_count{span_kind=~"SPAN_KIND_SERVER|SPAN_KIND_CONSUMER", job="${job.value}", __ignore_usage__="", status_code="STATUS_CODE_ERROR"} [$__rate_interval])) by (job) OR sum(rate(traces_spanmetrics_latency_count{span_kind=~"SPAN_KIND_SERVER|SPAN_KIND_CONSUMER", job="${job.value}", __ignore_usage__=""} [$__rate_interval])) by (job) * 0) / sum(rate(traces_spanmetrics_latency_count{span_kind=~"SPAN_KIND_SERVER|SPAN_KIND_CONSUMER", job="${job.value}", __ignore_usage__=""} [$__rate_interval])) by (job)`,
      duration: `histogram_quantile(0.95, sum(rate(traces_spanmetrics_latency_bucket{span_kind=~"SPAN_KIND_SERVER|SPAN_KIND_CONSUMER", job="${job.value}", __ignore_usage__=""} [$__rate_interval])) by (le,job))`,
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

    children.push(headerRow);
    children.push(row);
  });

  return children;
};

/**
 * WIP needs to add a different color, viz and other things based on R, E or D
 * @param query 
 * @param red 
 * @param index 
 * @returns 
 */
function redPanelItem(query: RedObject, red: 'rate'|'error'|'duration', index: number) {
  const redQuery = query[red];
  return new SceneCSSGridItem({
    gridColumn: 'span 3',
    // $behaviors: [hideEmptyPreviews('')],
    $data: new SceneQueryRunner({
      datasource: trailDS,
      maxDataPoints: MDP_METRIC_PREVIEW,
      queries: [
        {
          refId: `${query.job}-rate`,
          expr: redQuery,
          legendFormat: `${query.job} ${red}`
        }
      ],
    }),
    body: PanelBuilders.barchart()
      .setTitle(`${red.toLocaleUpperCase()}`)
      .setUnit('rps')
      .setOption('legend', { showLegend: false })
      .setOption('tooltip', { mode: TooltipDisplayMode.Multi, sort: SortOrder.Descending })
      .setCustomFieldConfig('fillOpacity', 9)
      .setOption('xTickLabelSpacing', 50)
      .setColor({ mode: 'fixed', fixedColor: getColorByIndex(index) })
      // .setDescription(description)
      // .setHeaderActions([
      //   new SelectMetricAction({ metric, title: 'Select' }),
      //   new AddToExplorationButton({ labelName: metric }),
      // ])
      .build(),
  });
}

function panelHeader(job: string) {
  return new SceneCSSGridItem({
    gridColumn: '1/-1',
    body: PanelBuilders.text()
      .setTitle(`Job: ${job}`)
      .setOption('content', '')
      .build()
  });
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
