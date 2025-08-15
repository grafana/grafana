import fs from 'fs';

import { test, expect } from '@grafana/plugin-e2e';

const DASH_PATH = '/d/bds35fot3cv7kb/mostly-blank-dashboard';

test('payload-size', { tag: '@performance' }, async ({ page }) => {
  let inflatedSize = 0;
  let transferSize = 0;
  let requests = 0;

  //page.on('console', msg => console.log(msg.text()));

  const addSize = async (response) => {
    if (response.status() === 200) {
      try {
        let body = await response.body();
        inflatedSize += body.length;

        const sizes = await response.request().sizes();

        transferSize += sizes.responseBodySize + sizes.responseHeadersSize;

        requests++;
      } catch (err) {
        console.error('Error calculating response:', err);
      }
    }
  };

  page.on('response', addSize);

  let start = performance.now();

  await page.goto(DASH_PATH);

  let el = page.getByTestId('data-testid header-container');
  await el.waitFor();

  // weird but random expect() is required so this whole thing doesn't go tits up with
  // "Error: page.goto: net::ERR_ABORTED; maybe frame was detached?"
  await expect(el).toBeVisible();

  let end = performance.now();

  let client = await page.context().newCDPSession(page);
  await client.send('HeapProfiler.collectGarbage');
  let usedJSHeapSize = (await client.send('Runtime.getHeapUsage')).usedSize;

  // Create performance data object
  const metricsWithLabels: PerformanceMetrics = {
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

  // Write json data to file
  const textExpositionData = convertToPrometheusFormat(metricsWithLabels);
  console.log(textExpositionData);
  fs.writeFileSync('/tmp/asset-metrics.txt', textExpositionData);

  // if we don't remove the listener the "test" will error.
  page.removeListener('response', addSize);
  //client.detach();
  page.close();
});

// DISCLAIMER. I had claude write all of this so it's probably terrible.

type PerformanceMetrics = Record<string, { value: number }>;

/**
 * Converts performance data with integrated labels to Prometheus exposition text format
 * https://github.com/prometheus/docs/blob/main/content/docs/instrumenting/exposition_formats.md#text-format-example
 * @param {Object} metrics - Object containing metrics with their values and labels
 * @returns {string} - Formatted Prometheus exposition text
 */
function convertToPrometheusFormat(metrics: PerformanceMetrics) {
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
