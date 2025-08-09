import fs from 'fs';

import { test, expect } from '@grafana/plugin-e2e';

import { PageResponseRecorder } from '../utils/PageResponseRecorder';

test('payload-size', { tag: '@performance' }, async ({ page, selectors }) => {
  const responseRecorder = new PageResponseRecorder(page);
  const stopListening = responseRecorder.listen();

  let start = performance.now();
  await page.goto('/d/e7146d1e-0fa6-4862-8658-2b734ba819e8/empty-dashboard');

  // Wait for the page to load completely
  const newPanelButton = page.getByTestId(selectors.pages.AddDashboard.itemButton('Create new panel button'));
  await expect(newPanelButton).toBeVisible();

  let end = performance.now();
  stopListening();

  let client = await page.context().newCDPSession(page);
  await client.send('HeapProfiler.collectGarbage');
  let usedJSHeapSize = (await client.send('Runtime.getHeapUsage')).usedSize;

  const { requests, inflatedSize, transferSize } = responseRecorder.getMetrics();

  // Create performance data object
  const metricsWithLabels: PerformanceData = {
    boot_time_seconds: {
      value: Math.round(end - start) / 1000,
    },
    requests_total: {
      value: requests,
    },
    inflated_size_bytes: {
      value: +inflatedSize.toFixed(1),
    },
    transfer_size_bytes: {
      value: +transferSize.toFixed(1),
    },
    used_js_heap_size_bytes: {
      value: +usedJSHeapSize.toFixed(1),
    },
  };

  // Metrics data to file
  const textExpositionData = convertToPrometheusFormat(metricsWithLabels);
  fs.writeFileSync('/tmp/asset-metrics.txt', textExpositionData);

  await page.close();
});

type PerformanceData = Record<string, { value: number | string }>;

/**
 * Converts performance data with integrated labels to Prometheus exposition text format
 * https://github.com/prometheus/docs/blob/main/content/docs/instrumenting/exposition_formats.md#text-format-example
 */
function convertToPrometheusFormat(metrics: PerformanceData): string {
  const lines: string[] = [];
  const timestamp = Date.now();

  // Process each metric
  for (const [metricName, metricData] of Object.entries(metrics)) {
    // Extract value and labels
    const { value, ...labels } = metricData;

    // Format labels as key="value" pairs
    let labelString = '';
    const formattedLabels = Object.entries(labels).map(([key, val]) => `${key}="${val}"`);

    if (formattedLabels.length > 0) {
      labelString = `{${formattedLabels.join(',')}}`;
    }

    // Add metric line - format: metric_name{label="value",...} value timestamp
    lines.push(`${metricName}${labelString} ${value} ${timestamp}`);

    // Add blank line. discovered the promlint parser needs this by accident.
    lines.push();
  }

  return lines.join('\n');
}
