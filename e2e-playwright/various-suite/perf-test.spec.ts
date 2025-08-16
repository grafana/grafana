import fs from 'fs';
import * as prom from 'prom-client';

import { test, expect } from '@grafana/plugin-e2e';

import { RequestsRecorder } from '../utils/RequestsRecorder';

const DASH_PATH = '/d/bds35fot3cv7kb/mostly-blank-dashboard';

test('payload-size', { tag: '@performance' }, async ({ page }) => {
  const promRegistry = new prom.Registry();

  const bootTimeSecondsGauge = new prom.Gauge({
    name: 'boot_time_seconds',
    help: 'The time it took for the application to boot',
    registers: [promRegistry],
  });

  const usedJSHeapSizeGauge = new prom.Gauge({
    name: 'used_js_heap_size_bytes',
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

  bootTimeSecondsGauge.set(Math.round(end - start) / 1000);
  usedJSHeapSizeGauge.set(+usedJSHeapSize.toFixed(1));

  promRegistry.setDefaultLabels({ instance: process.env.GRAFANA_URL });
  const metricsText = await promRegistry.metrics();
  console.log(metricsText);
  fs.writeFileSync('/tmp/asset-metrics.txt', metricsText);

  stopListening();
  page.close();
});
