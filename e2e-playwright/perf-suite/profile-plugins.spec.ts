import { test, expect } from '@grafana/plugin-e2e';

import { ITERATIONS, measure, setupPerf, waitForPanelsLoaded } from './perf';

test.describe('Perf: profile and plugins', { tag: ['@perf'] }, () => {
  test('change theme via the profile drawer', async ({ page }, testInfo) => {
    const cdp = await setupPerf(page);
    // A dashboard behind the drawer makes the theme change re-render real panels.
    await page.goto('/d/n1jR8vnnz');
    await waitForPanelsLoaded(page);

    await measure(page, cdp, testInfo, 'theme: open theme drawer', async () => {
      await page.getByRole('button', { name: 'Profile' }).click();
      await page.getByRole('menuitem', { name: 'Change theme' }).click();
      await page.getByRole('radiogroup').waitFor();
    });

    const background = () => page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    for (let i = 0; i < ITERATIONS; i++) {
      // The theme may persist between runs, so switch to whichever one isn't active. The drawer's
      // radios don't reflect the active theme, so the page's own background is the signal.
      const before = await background();
      const [r, g, b] = before.match(/\d+/g)!.map(Number);
      const target = r + g + b > 382 ? 'Dark' : 'Light';
      await measure(page, cdp, testInfo, 'theme: switch theme', async () => {
        await page.getByRole('radio', { name: target, exact: true }).click();
        await expect.poll(background).not.toBe(before);
      });
    }
  });

  test('plugins: list, filter and open details', async ({ page }, testInfo) => {
    const cdp = await setupPerf(page);
    const search = page.getByRole('textbox', { name: 'Search' });

    for (let i = 0; i < ITERATIONS; i++) {
      await measure(page, cdp, testInfo, 'plugins: load installed list', async () => {
        await page.goto('/plugins?filterBy=installed');
        await page
          .getByRole('link', { name: /TestData/ })
          .first()
          .waitFor();
      });

      await measure(page, cdp, testInfo, 'plugins: filter by search', async () => {
        await search.pressSequentially('test', { delay: 0 });
        await expect(page.getByRole('link', { name: /TestData/ }).first()).toBeVisible();
      });

      await measure(page, cdp, testInfo, 'plugins: filter by type', async () => {
        await search.fill('');
        await page.getByLabel('Plugin type filter').click();
        await page.getByRole('option', { name: 'Panels' }).click();
        await page
          .getByRole('link', { name: /Time series/ })
          .first()
          .waitFor();
      });

      await measure(page, cdp, testInfo, 'plugins: open plugin details', async () => {
        await page
          .getByRole('link', { name: /Time series/ })
          .first()
          .click();
        await page.waitForURL(/\/plugins\/timeseries/);
        await page.getByRole('heading', { name: 'Time series' }).first().waitFor();
      });
    }
  });
});
