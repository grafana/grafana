import { Page } from 'playwright-core';

export async function getPerformanceMetrics(page: Page, cb: Function) {
  const client = await page.context().newCDPSession(page);
  const start = performance.now();

  client.send('Performance.enable');

  await cb();

  const performanceMetrics = await client.send('Performance.getMetrics');
  const end = performance.now();

  return { duration: end - start, metrics: performanceMetrics.metrics };
}
