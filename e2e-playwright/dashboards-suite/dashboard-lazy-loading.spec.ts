import { test, expect, type Page } from '@playwright/test';

const dashboardUid = 'lazy-loading-review';
const dashboardTitle = 'Lazy loading review';
const dashboardPath = `/d/${dashboardUid}`;
// Webpack may extract the settings factory into a shared numbered chunk.
const settingsChunk = new RegExp(`/(${process.env.REVIEW_SETTINGS_CHUNK ?? 'dashboard-settings'})\\.[^/]+\\.js$`);
const shareChunk = /\/share-drawer\.[^/]+\.js$/;

test.beforeEach(async ({ page }) => {
  expect((await page.request.post('/login', { data: { user: 'admin', password: 'admin' } })).ok()).toBe(true);
  const response = await page.request.post('/api/dashboards/db', {
    data: {
      overwrite: true,
      dashboard: {
        uid: dashboardUid,
        title: dashboardTitle,
        schemaVersion: 42,
        editable: true,
        time: { from: 'now-6h', to: 'now' },
        templating: {
          list: [
            {
              name: 'Filters',
              type: 'adhoc',
              datasource: { type: 'grafana', uid: '-- Grafana --' },
              filters: [{ key: 'environment', operator: '=', value: 'production' }],
            },
          ],
        },
        panels: [
          {
            id: 1,
            type: 'text',
            title: 'Review panel',
            gridPos: { x: 0, y: 0, w: 12, h: 8 },
            options: { mode: 'markdown', content: 'Browser review content' },
          },
        ],
      },
    },
  });
  expect(response.ok(), await response.text()).toBe(true);
});

async function openSettings(page: Page) {
  await page.getByTestId('data-testid Edit dashboard button').click();
  await page.getByTestId('data-testid Dashboard Sidebar options button').click();
  await page.getByRole('button', { name: 'View all settings' }).click();
}

async function openShare(page: Page) {
  await page.getByTestId('data-testid new share button arrow menu').click();
  await page.getByTestId('data-testid new share button share internally').click();
}

async function holdChunk(page: Page, pattern: RegExp) {
  const pending = Promise.withResolvers<void>();
  let intercepted = false;
  await page.route(pattern, async (route) => {
    intercepted = true;
    await pending.promise;
    await route.continue();
  });
  return {
    wait: () =>
      expect.poll(() => intercepted, { message: 'The intended lazy chunk must actually be requested' }).toBe(true),
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

test('settings deep link survives reload and closes back to dashboard', async ({ page }) => {
  await page.goto(`${dashboardPath}?editview=settings`);
  await expect(page.getByLabel('Title', { exact: true })).toHaveValue(dashboardTitle);
  await expect(page).toHaveURL(/editview=settings/);
  await page.reload();
  await expect(page.getByLabel('Title', { exact: true })).toHaveValue(dashboardTitle);
  await page.getByTestId('data-testid Back to dashboard button').click();
  await expect(page.getByText('Browser review content')).toBeVisible();
  await expect(page).not.toHaveURL(/editview=/);
});

test('share deep link survives reload and closes without leaving its URL parameter', async ({ page }) => {
  await page.goto(`${dashboardPath}?shareView=link`);
  await expect(page.getByRole('button', { name: 'Copy link', exact: true }).last()).toBeVisible();
  await expect(page.getByText('Shorten link', { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByText('Shorten link', { exact: true })).toBeVisible();
  await page.getByTestId('data-testid Drawer close').click();
  await expect(page.getByText('Browser review content')).toBeVisible();
  await expect(page).not.toHaveURL(/shareView=/);
});

for (const entry of [
  { name: 'settings', chunk: settingsChunk, open: openSettings, parameter: 'editview' },
  { name: 'share', chunk: shareChunk, open: openShare, parameter: 'shareView' },
]) {
  test(`browser Back cancels pending ${entry.name}; Forward can open it again`, async ({ page }) => {
    const held = await holdChunk(page, entry.chunk);
    await page.goto(dashboardPath);
    await expect(page.getByText('Browser review content')).toBeVisible();
    await expect(page).not.toHaveURL(new RegExp(`${entry.parameter}=`));
    await entry.open(page);
    await held.wait();
    await expect(page).toHaveURL(new RegExp(`${entry.parameter}=`));
    await page.goBack();
    await expect(page).not.toHaveURL(new RegExp(`${entry.parameter}=`));
    await held.release();
    // Forward exercises the same document after the cancelled import has completed.
    await expect(page.getByText('Browser review content')).toBeVisible();
    await expect(page).not.toHaveURL(new RegExp(`${entry.parameter}=`));
    await page.goForward();
    if (entry.name === 'settings') {
      await expect(page.getByLabel('Title', { exact: true })).toHaveValue(dashboardTitle);
    } else {
      await expect(page.getByText('Shorten link', { exact: true })).toBeVisible();
    }
    await expect(page).toHaveURL(new RegExp(`${entry.parameter}=`));
  });
}

test('settings can retry after its first chunk request fails', async ({ page }) => {
  let rejected = false;
  await page.route(
    settingsChunk,
    async (route) => {
      rejected = true;
      await route.abort('failed');
    },
    { times: 1 }
  );
  await page.goto(dashboardPath);
  await openSettings(page);
  await expect.poll(() => rejected).toBe(true);
  await expect(page).not.toHaveURL(/editview=/);
  await page.getByRole('button', { name: 'View all settings' }).click();
  await expect(page.getByLabel('Title', { exact: true })).toHaveValue(dashboardTitle);
});

test('share can retry after its first chunk request fails', async ({ page }) => {
  let rejected = false;
  await page.route(
    shareChunk,
    async (route) => {
      rejected = true;
      await route.abort('failed');
    },
    { times: 1 }
  );
  await page.goto(dashboardPath);
  await openShare(page);
  await expect.poll(() => rejected).toBe(true);
  await expect(page).not.toHaveURL(/shareView=/);
  await openShare(page);
  await expect(page.getByText('Shorten link', { exact: true })).toBeVisible();
  await expect(page).toHaveURL(/shareView=link/);
});

test('Code pane applies a changed dashboard title', async ({ page }) => {
  await page.goto(dashboardPath);
  await page.getByTestId('data-testid Edit dashboard button').click();
  await page.getByTestId('data-testid Dashboard Sidebar code button').click();
  const editor = page.locator('.monaco-editor textarea').first();
  await expect(editor).toBeVisible();
  await editor.press('ControlOrMeta+a');
  await editor.press('ControlOrMeta+c');
  const resource = JSON.parse(await page.evaluate(() => navigator.clipboard.readText()));
  resource.spec.title = 'Title changed through Code';
  await page.evaluate((text) => navigator.clipboard.writeText(text), JSON.stringify(resource, null, 2));
  await editor.press('ControlOrMeta+a');
  await editor.press('ControlOrMeta+v');
  await editor.press('ControlOrMeta+a');
  await editor.press('ControlOrMeta+c');
  expect(JSON.parse(await page.evaluate(() => navigator.clipboard.readText())).spec.title).toBe(
    'Title changed through Code'
  );
  await page.getByRole('button', { name: 'Apply changes', exact: true }).click();
  await expect(
    page.getByRole('navigation', { name: 'Breadcrumbs' }).getByText('Title changed through Code', { exact: true })
  ).toBeVisible();
});

test('panel editor loading can be cancelled with browser Back', async ({ page }) => {
  const held = await holdChunk(page, /\/panel-edit\.[^/]+\.js$/);
  await page.goto(dashboardPath);
  await page.getByTestId('data-testid Panel header Review panel').hover();
  await page.getByTestId('data-testid Panel menu Review panel').click();
  await page.getByTestId('data-testid Panel menu item Edit').click();
  await held.wait();
  await expect(page).toHaveURL(/editPanel=/);
  await page.goBack();
  await expect(page).not.toHaveURL(/editPanel=/);
  await held.release();
  await expect(page.getByText('Browser review content')).toBeVisible();
  await expect(page).not.toHaveURL(/editPanel=/);
  await expect(page.getByTestId('data-testid Back to dashboard button')).toBeHidden();
});

test('Filters pane shows the persisted filter key and value', async ({ page }) => {
  await page.goto(dashboardPath);
  await page.getByRole('button', { name: 'Filters', exact: true }).click();
  await expect(page.getByText('Edit filters', { exact: true })).toBeVisible();
  await expect(page.getByText('environment', { exact: true }).last()).toBeVisible();
  await expect(page.getByText('production', { exact: true }).last()).toBeVisible();
});

test('Options remains selected when an earlier Code request finishes loading', async ({ page }) => {
  const held = await holdChunk(page, /\/dashboard-code-pane\.[^/]+\.js$/);
  await page.goto(dashboardPath);
  await page.getByTestId('data-testid Edit dashboard button').click();
  await page.getByTestId('data-testid Dashboard Sidebar code button').click();
  await held.wait();
  await page.getByTestId('data-testid Dashboard Sidebar options button').click();
  await expect(page.getByRole('button', { name: 'View all settings' })).toBeVisible();
  await held.release();
  await expect(page.getByRole('button', { name: 'View all settings' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Apply changes', exact: true })).toBeHidden();
});
