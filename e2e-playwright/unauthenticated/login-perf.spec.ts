import fs from 'fs';
import * as prom from 'prom-client';

import { test, expect } from '@grafana/plugin-e2e';

import { RequestsRecorder } from '../utils/RequestsRecorder';

test('login page asset sizes', { tag: '@login-page-performance' }, async ({ page, selectors }) => {
  const promRegistry = new prom.Registry();
  const testRunTimeGauge = new prom.Gauge({
    name: 'fe_perf_test_run_time_seconds',
    help: 'The time it took for the performance test to run',
    registers: [promRegistry],
  });

  const recorder = new RequestsRecorder(page);
  const stopListening = recorder.listen();
  const start = performance.now();

  await page.goto(selectors.pages.Login.url);
  await expect(page.getByTestId(selectors.pages.Login.username)).toBeVisible();

  const elapsedSeconds = Math.round(performance.now() - start) / 1000;
  await stopListening();

  for (const metric of recorder.getMetrics()) {
    promRegistry.registerMetric(metric);
  }
  testRunTimeGauge.set(elapsedSeconds);

  const instance = new URL(process.env.GRAFANA_URL || 'http://undefined').host;
  promRegistry.setDefaultLabels({ instance, page: 'login' });
  const metricsText = await promRegistry.metrics();
  console.log(metricsText);
  fs.writeFileSync(process.env.METRICS_OUTPUT_PATH || '/tmp/asset-metrics.txt', metricsText);

  await page.close();
});
