import { SceneFlexItem } from '@grafana/scenes';

import { DataTrail } from '../../DataTrail';

export const renderAsRedMetricsDisplay = async (trail: DataTrail): Promise<SceneFlexItem[]> => {
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
  const redQueriesByJob = [];
  for (const job of jobValues) {
    const queries = {
      job: job.text,
      rate: `sum(rate(traces_spanmetrics_latency_count{span_kind=~"SPAN_KIND_SERVER|SPAN_KIND_CONSUMER", job="${job.value}", cluster=~"prod-ap-northeast-0"} [$__rate_interval])) by (job)`,
      error: `(sum(rate(traces_spanmetrics_latency_count{span_kind=~"SPAN_KIND_SERVER|SPAN_KIND_CONSUMER", job="${job.value}", cluster=~"prod-ap-northeast-0", status_code="STATUS_CODE_ERROR"} [$__rate_interval])) by (job) OR sum(rate(traces_spanmetrics_latency_count{span_kind=~"SPAN_KIND_SERVER|SPAN_KIND_CONSUMER", job="${job.value}", cluster=~"prod-ap-northeast-0"} [$__rate_interval])) by (job) * 0) / sum(rate(traces_spanmetrics_latency_count{span_kind=~"SPAN_KIND_SERVER|SPAN_KIND_CONSUMER", job="${job.value}", cluster=~"prod-ap-northeast-0"} [$__rate_interval])) by (job)`,
      duration: `histogram_quantile(0.95, sum(rate(traces_spanmetrics_latency_bucket{span_kind=~"SPAN_KIND_SERVER|SPAN_KIND_CONSUMER", job="${job.value}", cluster=~"prod-ap-northeast-0"} [$__rate_interval])) by (le,job))`,
    }
    redQueriesByJob.push(queries);
  }

  // 3. Create the children panels grouped in 3


  // stretch: identify extra metrics associated with RED metrics
  // research
  return [];
};

