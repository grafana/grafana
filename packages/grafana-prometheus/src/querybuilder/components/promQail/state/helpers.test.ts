import { llms } from '@grafana/experimental';

import { guessMetricType, isLLMPluginEnabled } from './helpers';

// Mock the grafana-experimental llms module
jest.mock('@grafana/experimental', () => ({
  llms: {
    openai: {
      health: jest.fn(),
    },
    vector: {
      health: jest.fn(),
    },
  },
}));

describe('isLLMPluginEnabled', () => {
  it('should return true if LLM plugin is enabled', async () => {
    jest.mocked(llms.openai.health).mockResolvedValue({ ok: true, configured: true });
    jest.mocked(llms.vector.health).mockResolvedValue({ ok: true, enabled: true });

    const enabled = await isLLMPluginEnabled();

    expect(enabled).toBe(true);
  });

  it('should return false if LLM plugin is not enabled', async () => {
    jest.mocked(llms.openai.health).mockResolvedValue({ ok: false, configured: false });
    jest.mocked(llms.vector.health).mockResolvedValue({ ok: false, enabled: false });

    const enabled = await isLLMPluginEnabled();

    expect(enabled).toBe(false);
  });

  it('should return false if LLM plugin is enabled but health check fails', async () => {
    jest.mocked(llms.openai.health).mockResolvedValue({ ok: false, configured: true });
    jest.mocked(llms.vector.health).mockResolvedValue({ ok: false, enabled: true });

    const enabled = await isLLMPluginEnabled();

    expect(enabled).toBe(false);
  });
});

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
