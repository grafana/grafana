import { test } from '@grafana/plugin-e2e';

import { ITERATIONS, measure, setupPerf, waitForPanelsLoaded, waitForQuiet } from './perf';

const TESTDATA_UID = 'PD8C576611E62080A';

function exploreUrl(query: Record<string, unknown>) {
  const panes = {
    a: {
      datasource: TESTDATA_UID,
      queries: [{ refId: 'A', datasource: { type: 'grafana-testdata-datasource', uid: TESTDATA_UID }, ...query }],
      range: { from: 'now-6h', to: 'now' },
    },
  };
  return `/explore?schemaVersion=1&panes=${encodeURIComponent(JSON.stringify(panes))}`;
}

test.describe('Perf: explore', { tag: ['@perf'] }, () => {
  for (const [name, query] of [
    ['random walk (10 series)', { scenarioId: 'random_walk', seriesCount: 10 }],
    ['logs (1000 lines)', { scenarioId: 'logs', lines: 1000 }],
  ] as const) {
    test(`load: ${name}`, async ({ page }, testInfo) => {
      const cdp = await setupPerf(page);
      for (let i = 0; i < ITERATIONS; i++) {
        await measure(page, cdp, testInfo, `explore load: ${name}`, async () => {
          await page.goto(exploreUrl(query), { waitUntil: 'commit' });
          await waitForPanelsLoaded(page);
        });
      }
    });

    test(`run query: ${name}`, async ({ page, selectors, explorePage }, testInfo) => {
      const cdp = await setupPerf(page);
      await page.goto(exploreUrl(query), { waitUntil: 'commit' });
      await waitForPanelsLoaded(page);
      const run = explorePage.getByGrafanaSelector(selectors.components.RefreshPicker.runButtonV2);
      for (let i = 0; i < ITERATIONS; i++) {
        await measure(page, cdp, testInfo, `explore run query: ${name}`, () => run.click());
      }
    });
  }

  test('type in query editor', async ({ page }, testInfo) => {
    const cdp = await setupPerf(page);
    await page.goto(exploreUrl({ scenarioId: 'random_walk', seriesCount: 10 }));
    await waitForPanelsLoaded(page);
    const alias = page.getByLabel('Alias').first();
    for (let i = 0; i < ITERATIONS; i++) {
      await measure(page, cdp, testInfo, 'explore: type in query editor', async () => {
        await alias.fill('');
        await alias.pressSequentially('series-alias-$seriesIndex', { delay: 0 });
      });
      await waitForQuiet(page);
    }
  });
});
