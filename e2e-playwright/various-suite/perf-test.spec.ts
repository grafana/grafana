import fs from 'fs';
import * as prom from 'prom-client';

import { test, expect } from '@grafana/plugin-e2e';

import { RequestsRecorder } from '../utils/RequestsRecorder';

const DASH_PATH = '/d/bds35fot3cv7kb/mostly-blank-dashboard';

test('payload-size', { tag: '@performance' }, async ({ page }) => {
  const promRegistry = new prom.Registry();

  const testRunTimeGauge = new prom.Gauge({
    name: 'fe_perf_test_run_time_seconds',
    help: 'The time it took for the performance test to run',
    registers: [promRegistry],
  });

  const usedJSHeapSizeGauge = new prom.Gauge({
    name: 'fe_perf_used_js_heap_size_bytes',
    help: 'The amount of memory used by the JavaScript heap',
    registers: [promRegistry],
  });

  const recorder = new RequestsRecorder(page);
  const stopListening = recorder.listen();

  let start = performance.now();

  await page.goto(DASH_PATH);

  let el = page.getByTestId('data-testid header-container');
  await el.waitFor();
  await expect(el).toBeVisible();

  let end = performance.now();

  let client = await page.context().newCDPSession(page);
  await client.send('HeapProfiler.collectGarbage');
  let usedJSHeapSize = (await client.send('Runtime.getHeapUsage')).usedSize;

  const responseMetrics = recorder.getMetrics();
  for (const metric of responseMetrics) {
    promRegistry.registerMetric(metric);
  }

  testRunTimeGauge.set(Math.round(end - start) / 1000);
  usedJSHeapSizeGauge.set(+usedJSHeapSize.toFixed(1));

  const instance = new URL(process.env.GRAFANA_URL || 'http://undefined').host;
  promRegistry.setDefaultLabels({ instance });
  const metricsText = await promRegistry.metrics();
  console.log(metricsText);
  fs.writeFileSync(process.env.METRICS_OUTPUT_PATH || '/tmp/asset-metrics.txt', metricsText);

  await stopListening();
  page.close();
});
