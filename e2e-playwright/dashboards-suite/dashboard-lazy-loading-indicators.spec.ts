import { type Page } from '@playwright/test';
import { randomUUID } from 'node:crypto';

import { test as base, expect } from '@grafana/plugin-e2e';

const test = base.extend<{ dashboardPath: string }>({
  featureToggles: [{ dashboardNewLayouts: true, dashboardUnifiedDrilldownControls: true }, { scope: 'worker' }],
  dashboardPath: async ({ page }, provide) => {
    const uid = randomUUID();
    const response = await page.request.post('/api/dashboards/db', {
      data: {
        dashboard: {
          uid,
          title: `Loading indicators ${uid}`,
          schemaVersion: 42,
          time: { from: 'now-6h', to: 'now' },
          templating: {
            list: [
              { name: 'Filters', type: 'adhoc', datasource: { type: 'grafana', uid: '-- Grafana --' }, filters: [] },
            ],
          },
          panels: [
            {
              id: 1,
              type: 'text',
              title: 'Loading test',
              gridPos: { x: 0, y: 0, w: 12, h: 8 },
              options: { mode: 'markdown', content: 'Dashboard content' },
            },
          ],
        },
      },
    });
    expect(response.ok(), await response.text()).toBe(true);
    try {
      await provide(`/d/${uid}`);
    } finally {
      expect((await page.request.delete(`/api/dashboards/uid/${uid}`)).ok()).toBe(true);
    }
  },
});

async function holdChunk(page: Page, pattern: RegExp) {
  const pending = Promise.withResolvers<void>();
  let intercepted = false;
  await page.route(pattern, async (route) => {
    intercepted = true;
    await pending.promise;
    await route.continue();
  });
  return {
    wait: () => expect.poll(() => intercepted, { message: 'The lazy chunk must be requested' }).toBe(true),
    release: async () => {
      const loaded = page.waitForResponse(pattern);
      pending.resolve();
      await (await loaded).finished();
      await page.unroute(pattern);
      await page.evaluate(
        () => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())))
      );
    },
  };
}

for (const pane of ['Add', 'Filters'] as const) {
  test(`${pane} shows a loading bar until its chunk resolves`, async ({ page, dashboardPath, selectors }, testInfo) => {
    const chunk = pane === 'Add' ? /\/dashboard-add-new-pane\.[^/]+\.js$/ : /\/dashboard-filters-overview\.[^/]+\.js$/;
    const held = await holdChunk(page, chunk);
    await page.goto(dashboardPath);
    await page.getByTestId(selectors.components.NavToolbar.editDashboard.editButton).click();
    if (pane === 'Add') {
      await page.getByTestId(selectors.pages.Dashboard.Sidebar.addButton).click();
    } else {
      await page.getByRole('button', { name: 'Filters', exact: true }).click();
    }
    await held.wait();
    const loading = page.getByRole('status', { name: 'Loading sidebar' });
    await expect(loading).toBeVisible();
    await page.getByText('Dashboard content', { exact: true }).hover();
    await expect
      .poll(() =>
        loading.evaluate((element) => {
          const bar = element.getBoundingClientRect();
          const container = element.parentElement!.getBoundingClientRect();
          return bar.right > container.left && bar.left < container.right;
        })
      )
      .toBe(true);
    await page.screenshot({ path: testInfo.outputPath(`${pane}-loading.png`) });
    await held.release();
    if (pane === 'Add') {
      await expect(page.getByTestId(selectors.components.Sidebar.headerTitle)).toHaveText('Add');
    } else {
      await expect(page.getByText('Edit filters', { exact: true })).toBeVisible();
    }
    await expect(loading).toBeHidden();
  });
}

test('closing a loading sidebar prevents it reopening when its chunk arrives', async ({
  page,
  dashboardPath,
  selectors,
}) => {
  const held = await holdChunk(page, /\/dashboard-add-new-pane\.[^/]+\.js$/);
  await page.goto(dashboardPath);
  await page.getByTestId(selectors.components.NavToolbar.editDashboard.editButton).click();
  await page.getByTestId(selectors.pages.Dashboard.Sidebar.addButton).click();
  await held.wait();
  await expect(page.getByRole('status', { name: 'Loading sidebar' })).toBeVisible();
  await page.getByText('Dashboard content', { exact: true }).hover();
  await expect(page.getByRole('tooltip')).toBeHidden();
  await page.getByTestId(selectors.components.Sidebar.closePane).click();
  await expect(page.getByRole('status', { name: 'Loading sidebar' })).toBeHidden();
  await held.release();
  await expect(page.getByTestId(selectors.components.Sidebar.headerTitle)).toBeHidden();
  await page.getByTestId(selectors.pages.Dashboard.Sidebar.addButton).click();
  await expect(page.getByTestId(selectors.components.Sidebar.headerTitle)).toHaveText('Add');
});

test('Options shows a loading bar on first load, then opens without it from cache', async ({
  page,
  dashboardPath,
  selectors,
}) => {
  const held = await holdChunk(page, /\/dashboard-edit-actions\.[^/]+\.js$/);
  await page.goto(dashboardPath);
  await page.getByTestId(selectors.components.NavToolbar.editDashboard.editButton).click();
  await page.getByTestId(selectors.pages.Dashboard.Sidebar.optionsButton).click();
  await held.wait();
  await expect(page.getByRole('status', { name: 'Loading sidebar' })).toBeVisible();
  await held.release();
  await expect(page.getByRole('button', { name: 'View all settings' })).toBeVisible();
  await expect(page.getByRole('status', { name: 'Loading sidebar' })).toBeHidden();
  await page.getByTestId(selectors.components.Sidebar.closePane).click();
  await page.getByTestId(selectors.pages.Dashboard.Sidebar.optionsButton).click();
  await expect(page.getByRole('button', { name: 'View all settings' })).toBeVisible();
  await expect(page.getByRole('status', { name: 'Loading sidebar' })).toBeHidden();
});

const drawerTest = test.extend({
  featureToggles: [{ dashboardNewLayouts: false, dashboardUnifiedDrilldownControls: true }, { scope: 'worker' }],
  // The classic Filters renderer has an independent hook-order bug with rendering before activation.
  openFeature: [{ flags: { 'grafana.scenesFlickeringFix': false } }, { scope: 'worker' }],
});

for (const closeWhileLoading of [false, true]) {
  drawerTest(
    closeWhileLoading
      ? 'closing a loading drawer cancels it and permits reopening'
      : 'drawer replaces its loading bar with the loaded content',
    async ({ page, dashboardPath, selectors }, testInfo) => {
      const held = await holdChunk(page, /\/dashboard-filters-overview\.[^/]+\.js$/);
      await page.goto(dashboardPath);
      await page.getByTestId('filters-overview-expand').click();
      await held.wait();
      await expect(page.getByRole('status', { name: 'Loading drawer' })).toBeVisible();
      await expect(page.getByRole('dialog')).toBeInViewport({ ratio: 1 });
      await expect
        .poll(async () => {
          const bar = await page.getByRole('status', { name: 'Loading drawer' }).locator('..').boundingBox();
          const header = await page.getByRole('dialog').locator('[class*="drawer-header"]').boundingBox();
          if (!bar || !header) {
            return null;
          }
          return {
            leftInset: Math.round(bar.x - header.x),
            rightInset: Math.round(header.x + header.width - bar.x - bar.width),
            gapBelowDivider: Math.round(bar.y - header.y - header.height),
          };
        })
        .toEqual({ leftInset: 0, rightInset: 0, gapBelowDivider: 0 });
      await page.screenshot({ path: testInfo.outputPath('drawer-loading.png') });
      if (closeWhileLoading) {
        await page.getByTestId(selectors.components.Drawer.General.close).click();
        await expect(page.getByRole('status', { name: 'Loading drawer' })).toBeHidden();
      }
      await held.release();
      if (closeWhileLoading) {
        await expect(page.getByText('Edit filters', { exact: true })).toBeHidden();
        await page.getByTestId('filters-overview-expand').click();
      }
      await expect(page.getByText('Edit filters', { exact: true })).toBeVisible();
      await expect(page.getByRole('status', { name: 'Loading drawer' })).toBeHidden();
    }
  );
}
