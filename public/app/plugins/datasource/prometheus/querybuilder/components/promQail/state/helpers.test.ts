import { guessMetricType } from './helpers';

const metricListWithType = [
  // below is summary metric family
  ['go_gc_duration_seconds', 'summary'],
  ['go_gc_duration_seconds_count', 'summary'],
  ['go_gc_duration_seconds_sum', 'summary'],
  // below is histogram metric family
  ['go_gc_heap_allocs_by_size_bytes_total_bucket', 'histogram'],
  ['go_gc_heap_allocs_by_size_bytes_total_count', 'histogram'],
  ['go_gc_heap_allocs_by_size_bytes_total_sum', 'histogram'],
  // below are counters
  ['go_gc_heap_allocs_bytes_total', 'counter'],
  ['scrape_samples_post_metric_relabeling', 'counter'],
  // below are gauges
  ['go_gc_heap_goal_bytes', 'gauge'],
  ['nounderscorename', 'gauge'],
  // below is both a histogram & summary
  ['alertmanager_http_response_size_bytes', 'histogram,summary'],
  ['alertmanager_http_response_size_bytes_bucket', 'histogram,summary'],
  ['alertmanager_http_response_size_bytes_count', 'histogram,summary'],
  ['alertmanager_http_response_size_bytes_sum', 'histogram,summary'],
];

const metricList = metricListWithType.map((item) => item[0]);

describe('guessMetricType', () => {
  it.each(metricListWithType)("where input is '%s'", (metric: string, metricType: string) => {
    expect(guessMetricType(metric, metricList)).toBe(metricType);
  });
});
