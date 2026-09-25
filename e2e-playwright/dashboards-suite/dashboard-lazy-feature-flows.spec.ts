import { readFile } from 'fs/promises';

import { expect } from '@grafana/plugin-e2e';

import { test } from './utils/dashboard-lazy-feature-flows';

test.use({
  viewport: { width: 1440, height: 1000 },
  featureToggles: { dashboardNewLayouts: true },
  openFeature: {
    flags: {
      'grafana.dashboardSettingsRedesign': false,
      'grafana.customDashboardTemplates': true,
      'grafana.onDemandDiagnostics': true,
      queryEditorNext: false,
    },
  },
});

test.afterEach(async ({ page }, testInfo) => {
  const path = testInfo.outputPath('screen.png');
  await page.screenshot({ path, fullPage: true, animations: 'disabled' });
  await testInfo.attach('screen', { path, contentType: 'image/png' });
});

test.describe('Fresh-page settings renderers', () => {
  for (const view of [
    'settings',
    'annotations',
    'variables',
    'links',
    'versions',
    'permissions',
    'json-model',
    'template',
  ]) {
    test(`${view} loads its own content`, async ({ page, gotoDashboardPage, dashboardUid }) => {
      await gotoDashboardPage({ uid: dashboardUid, queryParams: new URLSearchParams({ editview: view }) });
      switch (view) {
        case 'settings':
          await expect(page.getByRole('textbox', { name: 'Title', exact: true })).toHaveValue(
            'Lazy loading verification'
          );
          break;
        case 'annotations':
          await expect(page.getByRole('button', { name: 'Add annotation query' })).toBeVisible();
          await page.getByRole('button', { name: 'Add annotation query' }).click();
          await expect(page.getByRole('textbox', { name: 'Name', exact: true })).toBeVisible();
          break;
        case 'variables':
          await expect(page.getByRole('button', { name: 'Add variable' })).toBeVisible();
          await page.getByRole('button', { name: 'Add variable' }).click();
          await expect(page.getByRole('textbox', { name: /^Name The name/ })).toBeVisible();
          break;
        case 'links':
          await page.getByRole('button', { name: 'Add dashboard link' }).click();
          await expect(page.getByRole('textbox', { name: 'Title', exact: true })).toBeVisible();
          break;
        case 'versions':
          await expect(page.getByRole('table')).toContainText('Version');
          await expect(page.getByRole('table')).toContainText('1');
          break;
        case 'permissions':
          await expect(page.getByRole('button', { name: /Add.*permission/i })).toBeVisible();
          break;
        case 'json-model':
          await expect(page.getByRole('textbox', { name: /Editor content/ })).toBeVisible();
          await expect(page.getByRole('button', { name: 'Save changes', exact: true })).toBeEnabled();
          break;
        case 'template':
          await expect(page.getByText('Template metadata unavailable', { exact: true })).toBeVisible();
          await expect(
            page.getByText('This dashboard is not being edited as a template, so template settings cannot be shown.')
          ).toBeVisible();
      }
    });
  }
});

test('JSON model saves edited title and survives reload', async ({
  page,
  gotoDashboardPage,
  dashboardUid,
  request,
}) => {
  await gotoDashboardPage({ uid: dashboardUid, queryParams: new URLSearchParams({ editview: 'json-model' }) });
  const editor = page.getByRole('textbox', { name: /Editor content/ });
  await expect(editor).toBeVisible();
  await editor.click();
  await editor.press('Control+f');
  const find = page.getByRole('textbox', { name: 'Find', exact: true });
  await find.fill('Lazy loading verification');
  await find.press('Enter');
  await find.press('Escape');
  await page.keyboard.insertText('Saved through lazy JSON editor');
  await page.getByRole('heading', { name: 'Settings', exact: true }).click();
  await page.getByRole('button', { name: 'Save changes', exact: true }).click();
  await expect
    .poll(async () => {
      const response = await request.get(`/api/dashboards/uid/${dashboardUid}`);
      return (await response.json()).dashboard.title;
    })
    .toBe('Saved through lazy JSON editor');
  await page.reload();
  await expect(page.getByRole('link', { name: 'Saved through lazy JSON editor', exact: true })).toBeVisible();
});

test('action modal saves edits and discards cancelled changes', async ({
  page,
  gotoDashboardPage,
  dashboardUid,
  selectors,
}, testInfo) => {
  const dashboard = await gotoDashboardPage({
    uid: dashboardUid,
    queryParams: new URLSearchParams({ editPanel: '3' }),
  });
  const group = dashboard.getByGrafanaSelector(selectors.components.OptionsGroup.toggle('Data links and actions'));
  await expect(group).toBeVisible();
  if ((await group.getAttribute('aria-expanded')) !== 'true') {
    await group.click();
  }
  await page.getByRole('button', { name: 'Add action', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('textbox', { name: 'Title', exact: true }).click();
  await dialog.getByRole('textbox', { name: 'Title', exact: true }).pressSequentially('Inspect service');
  await dialog.getByRole('textbox', { name: 'URL', exact: true }).click();
  await dialog.getByRole('textbox', { name: 'URL', exact: true }).pressSequentially('https://example.com/inspect');
  await dialog.getByRole('textbox', { name: 'URL', exact: true }).press('Tab');
  await testInfo.attach('action-editor', {
    body: await page.screenshot({ animations: 'disabled' }),
    contentType: 'image/png',
  });
  await dialog.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(dialog).toBeHidden();
  await page.getByRole('button', { name: 'Edit', exact: true }).click();
  await expect(dialog.getByRole('textbox', { name: 'URL', exact: true })).toHaveValue('https://example.com/inspect');
  await dialog.getByRole('textbox', { name: 'Title', exact: true }).click();
  await dialog.getByRole('textbox', { name: 'Title', exact: true }).fill('Cancelled title');
  await expect(dialog.getByRole('textbox', { name: 'Title', exact: true })).toHaveValue('Cancelled title');
  await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
  await page.getByRole('button', { name: 'Edit', exact: true }).click();
  await expect(dialog.getByRole('textbox', { name: 'Title', exact: true })).toHaveValue('Inspect service');
});

test('Canvas background picker applies image and cancels a later draft', async ({
  page,
  gotoDashboardPage,
  dashboardUid,
}, testInfo) => {
  await gotoDashboardPage({ uid: dashboardUid, queryParams: new URLSearchParams({ editPanel: '2' }) });
  const canvas = page.getByTestId('canvas-scene');
  await expect(canvas).toBeVisible();
  await canvas.click({ button: 'right' });
  await page.getByRole('menuitem', { name: 'Set background', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('button', { name: 'URL', exact: true }).click();
  // Use a served asset so the browser verifies a real image without an external dependency.
  // eslint-disable-next-line @grafana/no-restricted-img-srcs
  const imageUrl = `${new URL(page.url()).origin}/public/build/img/grafana_icon.svg`;
  await dialog.getByRole('textbox').fill(imageUrl);
  await expect
    .poll(() =>
      dialog
        .getByRole('img', { name: 'Preview of the selected URL' })
        .evaluate((img: HTMLImageElement) => img.naturalWidth)
    )
    .toBeGreaterThan(0);
  await testInfo.attach('background-picker', { body: await page.screenshot(), contentType: 'image/png' });
  await dialog.getByRole('button', { name: 'Select', exact: true }).click();
  await expect(dialog).toBeHidden();
  await canvas.click({ button: 'right' });
  await page.getByRole('menuitem', { name: 'Set background', exact: true }).click();
  await expect(dialog.getByRole('textbox')).toHaveValue(imageUrl);
  await dialog.getByRole('textbox').fill('https://example.com/cancelled.png');
  await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
  await canvas.click({ button: 'right' });
  await page.getByRole('menuitem', { name: 'Set background', exact: true }).click();
  await expect(dialog.getByRole('textbox')).toHaveValue(imageUrl);
});

test('export downloads JSON containing the dashboard and panels', async ({ page, gotoDashboardPage, dashboardUid }) => {
  await gotoDashboardPage({ uid: dashboardUid, queryParams: new URLSearchParams({ shareView: 'export' }) });
  await expect(page.getByRole('textbox', { name: 'Dashboard definition' })).toBeVisible();
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download file', exact: true }).click();
  const download = await downloadPromise;
  const path = await download.path();
  const exported = JSON.parse(await readFile(path!, 'utf8'));
  expect(exported.spec.title).toBe('Lazy loading verification');
  expect(
    Object.values<{ spec: { title: string } }>(exported.spec.elements)
      .map((panel) => panel.spec.title)
      .sort()
  ).toEqual(['Action table', 'Canvas background', 'Expression result']);
});

test('expression editor changes Math and executes the new result', async ({
  page,
  gotoDashboardPage,
  dashboardUid,
}) => {
  await gotoDashboardPage({ uid: dashboardUid, queryParams: new URLSearchParams({ editPanel: '1' }) });
  const expression = page.getByPlaceholder(/Math operations on one or more queries/);
  await expect(expression).toHaveValue('2 + 3');
  await expression.fill('6 * 7');
  const queryResponse = page.waitForResponse(
    (response) => response.url().includes('/api/ds/query') && response.request().method() === 'POST'
  );
  await expression.press('Tab');
  const response = await queryResponse;
  expect(response.ok()).toBe(true);
  const result = await response.json();
  expect(result.results.A.frames[0].data.values).toContainEqual([42]);
  await expect(page.getByText('42', { exact: true }).first()).toBeVisible();
});

for (const view of ['link', 'public_dashboard', 'snapshot', 'image']) {
  test(`fresh ${view} sharing drawer loads its controls`, async ({ page, gotoDashboardPage, dashboardUid }) => {
    await gotoDashboardPage({ uid: dashboardUid, queryParams: new URLSearchParams({ shareView: view }) });
    switch (view) {
      case 'link':
        await expect(page.getByRole('switch', { name: /Lock time range/i })).toBeVisible();
        await expect(page.getByRole('button', { name: /Copy link/i })).toBeEnabled();
        break;
      case 'public_dashboard':
        await expect(page.getByRole('checkbox')).toBeVisible();
        await expect(page.getByRole('button', { name: 'Accept', exact: true })).toBeDisabled();
        await page.getByText('I understand that this entire dashboard will be public.', { exact: false }).click();
        await expect(page.getByRole('button', { name: 'Accept', exact: true })).toBeEnabled();
        break;
      case 'snapshot':
        await expect(page.getByRole('button', { name: /Publish snapshot/i })).toBeEnabled();
        break;
      case 'image':
        await expect(page.getByRole('status')).toContainText('Image renderer plugin not installed');
        break;
    }
  });
}

test('delayed settings chunk preserves shell and reveals usable settings after release', async ({
  page,
  dashboardUid,
}) => {
  let intercepted = false;
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route('**/public/build/*.js', async (route) => {
    const response = await route.fetch();
    const body = await response.text();
    // The renderer's translation key survives minification and avoids hashed chunk names.
    if (body.includes('dashboard-settings.general.title-label')) {
      intercepted = true;
      await gate;
    }
    await route.fulfill({ response });
  });
  try {
    await page.goto(`/d/${dashboardUid}?editview=settings`, { waitUntil: 'domcontentloaded' });
    await expect.poll(() => intercepted).toBe(true);
    await expect(page.getByRole('navigation', { name: 'Breadcrumbs' })).toBeVisible();
    await expect(page.getByRole('textbox', { name: 'Title', exact: true })).toHaveCount(0);
    release();
    const title = page.getByRole('textbox', { name: 'Title', exact: true });
    await expect(title).toHaveValue('Lazy loading verification');
    await title.fill('Settings loaded after delayed chunk');
    await expect(title).toHaveValue('Settings loaded after delayed chunk');
  } finally {
    release();
    await page.unrouteAll({ behavior: 'wait' });
  }
});
