import { test } from '@grafana/plugin-e2e';

import { ITERATIONS, measure, setupPerf, waitForQuiet } from './perf';

// Panel ids in the devenv "Panel tests - All panels" dashboard.
const ALL_PANELS = 'n1jR8vnnz';
const PANELS = [
  { type: 'stat', id: 16 },
  { type: 'gauge', id: 18 },
  { type: 'bar gauge', id: 20 },
  { type: 'table', id: 22 },
  { type: 'bar chart', id: 14 },
  { type: 'pie chart', id: 24 },
  { type: 'heatmap', id: 26 },
  { type: 'state timeline', id: 41 },
  { type: 'logs', id: 28 },
];

test.describe('Perf: panel options', { tag: ['@perf'] }, () => {
  for (const { type, id } of PANELS) {
    test(`edit options: ${type}`, async ({ page }, testInfo) => {
      const cdp = await setupPerf(page);
      const title = page.getByRole('textbox', { name: 'Title' });
      const search = page.getByPlaceholder('Search options');

      for (let i = 0; i < ITERATIONS; i++) {
        await measure(page, cdp, testInfo, `open panel editor: ${type}`, async () => {
          await page.goto(`/d/${ALL_PANELS}?editPanel=${id}`);
          await title.waitFor({ timeout: 15_000 });
        });
        await measure(page, cdp, testInfo, `panel editor: type in title (${type})`, async () => {
          await title.fill('');
          await title.pressSequentially('A much longer panel title', { delay: 0 });
        });
        await page.getByRole('button', { name: 'Search options' }).click();
        await measure(page, cdp, testInfo, `panel editor: search options (${type})`, async () => {
          await search.pressSequentially('color', { delay: 0 });
          await search.fill('');
        });
        // The next goto leaves without saving, so every iteration starts from the provisioned panel.
        await waitForQuiet(page);
      }
    });
  }
});
