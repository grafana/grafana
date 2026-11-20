import { test, expect } from '@grafana/plugin-e2e';

import { ITERATIONS, measure, setupPerf, waitForPanelsLoaded } from './perf';

const ALL_PANELS = 'n1jR8vnnz';
const TIMESERIES_STACKING = 'Ei86FP_Mx';
const TABLE_KITCHEN_SINK = 'dcb9f5e9-8066-4397-889e-864b99555dbb';
const REPEATING_KITCHEN_SINK = 'hxQwTjpnk';

test.describe('Perf: dashboard view', { tag: ['@perf'] }, () => {
  for (const [name, uid] of [
    ['all panels', ALL_PANELS],
    ['timeseries stacking', TIMESERIES_STACKING],
    ['table kitchen sink', TABLE_KITCHEN_SINK],
    ['repeating kitchen sink', REPEATING_KITCHEN_SINK],
  ]) {
    test(`load: ${name}`, async ({ page }, testInfo) => {
      const cdp = await setupPerf(page);
      for (let i = 0; i < ITERATIONS; i++) {
        await measure(page, cdp, testInfo, `dashboard load: ${name}`, async () => {
          await page.goto(`/d/${uid}`);
          await waitForPanelsLoaded(page);
        });
      }
    });
  }

  test('refresh: all panels', async ({ page, selectors, gotoDashboardPage }, testInfo) => {
    const cdp = await setupPerf(page);
    const dashboardPage = await gotoDashboardPage({ uid: ALL_PANELS });
    await waitForPanelsLoaded(page);
    const refresh = dashboardPage.getByGrafanaSelector(selectors.components.RefreshPicker.runButtonV2);
    for (let i = 0; i < ITERATIONS; i++) {
      await measure(page, cdp, testInfo, 'dashboard refresh: all panels', () => refresh.click());
    }
  });

  test('tooltip hover: timeseries stacking', async ({ page, gotoDashboardPage }, testInfo) => {
    const cdp = await setupPerf(page);
    await gotoDashboardPage({ uid: TIMESERIES_STACKING });
    await waitForPanelsLoaded(page);
    const plot = page.locator('.u-over').first();
    const box = (await plot.boundingBox())!;
    for (let i = 0; i < ITERATIONS; i++) {
      await measure(page, cdp, testInfo, 'tooltip hover sweep: timeseries', async () => {
        await page.mouse.move(box.x + 1, box.y + box.height / 2);
        await page.mouse.move(box.x + box.width - 1, box.y + box.height / 2, { steps: 60 });
      });
      await page.mouse.move(0, 0);
    }
  });

  test('change time range: all panels', async ({ page, selectors, gotoDashboardPage }, testInfo) => {
    const cdp = await setupPerf(page);
    const dashboardPage = await gotoDashboardPage({ uid: ALL_PANELS });
    await waitForPanelsLoaded(page);
    const ranges = ['Last 15 minutes', 'Last 6 hours'];
    for (let i = 0; i < ITERATIONS; i++) {
      await measure(page, cdp, testInfo, 'time range change: all panels', async () => {
        await dashboardPage.getByGrafanaSelector(selectors.components.TimePicker.openButton).click();
        await page.getByText(ranges[i % ranges.length], { exact: true }).click();
      });
    }
  });
});

test.describe('Perf: dashboard edit', { tag: ['@perf'] }, () => {
  test('toggle edit mode: all panels', async ({ page, selectors, gotoDashboardPage }, testInfo) => {
    const cdp = await setupPerf(page);
    const dashboardPage = await gotoDashboardPage({ uid: ALL_PANELS });
    await waitForPanelsLoaded(page);
    const edit = dashboardPage.getByGrafanaSelector(selectors.components.NavToolbar.editDashboard.editButton);
    const exit = page.getByRole('button', { name: 'Exit edit mode' });
    for (let i = 0; i < ITERATIONS; i++) {
      await measure(page, cdp, testInfo, 'enter edit mode: all panels', async () => {
        await edit.click();
        await expect(exit).toBeVisible();
      });
      await measure(page, cdp, testInfo, 'exit edit mode: all panels', async () => {
        await exit.click();
        await expect(edit).toBeVisible();
      });
    }
  });

  test('open panel editor: timeseries', async ({ page }, testInfo) => {
    const cdp = await setupPerf(page);
    for (let i = 0; i < ITERATIONS; i++) {
      await measure(page, cdp, testInfo, 'open panel editor: timeseries', async () => {
        await page.goto(`/d/${TIMESERIES_STACKING}?editPanel=3`);
        await page.getByRole('textbox', { name: 'Title' }).waitFor({ timeout: 15_000 });
      });
    }
  });

  test('panel editor interactions: timeseries', async ({ page, selectors, gotoPanelEditPage }, testInfo) => {
    const cdp = await setupPerf(page);
    const panelEditPage = await gotoPanelEditPage({ dashboard: { uid: TIMESERIES_STACKING }, id: '3' });
    const title = page.getByRole('textbox', { name: 'Title' });
    await title.waitFor({ timeout: 15_000 });
    const search = page.getByPlaceholder('Search options');
    const vizPicker = panelEditPage.getByGrafanaSelector(selectors.components.PanelEditor.toggleVizPicker);

    for (let i = 0; i < ITERATIONS; i++) {
      await measure(page, cdp, testInfo, 'panel editor: type in title', async () => {
        await title.fill('');
        await title.pressSequentially('A much longer panel title', { delay: 0 });
      });
      await page.getByRole('button', { name: 'Search options' }).click();
      await measure(page, cdp, testInfo, 'panel editor: search options', async () => {
        await search.pressSequentially('legend', { delay: 0 });
        await search.fill('');
      });
      await measure(page, cdp, testInfo, 'panel editor: open viz picker', async () => {
        await vizPicker.click();
        await panelEditPage.getByGrafanaSelector(selectors.components.PanelEditor.VizTypePicker.searchInput).waitFor();
      });
      await page.getByRole('button', { name: 'Close', exact: true }).click();
      await title.waitFor();
    }
  });
});
