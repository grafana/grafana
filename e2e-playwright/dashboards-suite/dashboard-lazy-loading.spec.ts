import { type Page, type TestInfo } from '@playwright/test';

import { expect } from '@grafana/plugin-e2e';

import { test, holdChunk } from './utils/dashboard-lazy-loading';

async function openSettings(page: Page) {
  await page.getByTestId('data-testid Edit dashboard button').click();
  await page.getByTestId('data-testid Dashboard Sidebar options button').click();
  await page.getByRole('button', { name: 'View all settings' }).click();
}

// Settings chunk cancellation and retry coverage needs the URL-sync lazy-loading follow-up.
test(
  'settings supports deep links, reload, close, and browser history',
  { tag: '@behavior' },
  async ({ page, dashboardPath, dashboardTitle }) => {
    await page.goto(`${dashboardPath}?editview=settings`);
    await expect(page.getByLabel('Title', { exact: true })).toHaveValue(dashboardTitle);
    await expect(page).toHaveURL(/editview=settings/);
    await page.reload();
    await expect(page.getByLabel('Title', { exact: true })).toHaveValue(dashboardTitle);
    await page.getByTestId('data-testid Back to dashboard button').click();
    await expect(page.getByText('Browser review content')).toBeVisible();
    await expect(page).not.toHaveURL(/editview=/);

    await page.goto(dashboardPath);
    await openSettings(page);
    await expect(page.getByLabel('Title', { exact: true })).toHaveValue(dashboardTitle);
    await expect(page).toHaveURL(/editview=/);
    await page.goBack();
    await expect(page.getByText('Browser review content')).toBeVisible();
    await expect(page.getByLabel('Title', { exact: true })).toBeHidden();
    await expect(page).not.toHaveURL(/editview=/);
    await page.goForward();
    await expect(page.getByLabel('Title', { exact: true })).toHaveValue(dashboardTitle);
    await expect(page).toHaveURL(/editview=/);
  }
);

// Code is eagerly reachable through JsonModelEditView; pending-import coverage needs a separate chunk.
test(
  'Code applies edits and preserves them when switching to Options and back',
  { tag: '@behavior' },
  async ({ page, dashboardPath, dashboardTitle }) => {
    await page.goto(dashboardPath);
    await page.getByTestId('data-testid Edit dashboard button').click();
    await page.getByTestId('data-testid Dashboard Sidebar code button').click();
    const editor = page.locator('.monaco-editor textarea').first();
    await expect(editor).toBeVisible();
    // Monaco chooses shortcuts from the emulated user agent, not the test runner's OS.
    const modifier = await page.evaluate(() => (navigator.userAgent.includes('Macintosh') ? 'Meta' : 'Control'));
    await editor.press(`${modifier}+f`);
    const find = page.getByRole('textbox', { name: 'Find', exact: true });
    await find.fill(dashboardTitle);
    await expect(page.getByText('1 of 1', { exact: true })).toBeVisible();
    await find.press('Escape');
    await page.keyboard.insertText('Title changed through Code');
    await page.getByRole('button', { name: 'Apply changes', exact: true }).click();
    await expect(
      page.getByRole('navigation', { name: 'Breadcrumbs' }).getByText('Title changed through Code', { exact: true })
    ).toBeVisible();
    await page.getByTestId('data-testid Dashboard Sidebar options button').click();
    await expect(page.getByRole('button', { name: 'View all settings' })).toBeVisible();
    await expect(editor).toBeHidden();
    await expect(page.getByRole('button', { name: 'Apply changes', exact: true })).toBeHidden();
    await page.getByTestId('data-testid Dashboard Sidebar code button').click();
    await expect(editor).toBeVisible();
    await expect(page.getByRole('button', { name: 'Apply changes', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'View all settings' })).toBeHidden();
    await editor.press(`${modifier}+f`);
    await find.fill('Title changed through Code');
    await expect(page.getByText('1 of 1', { exact: true })).toBeVisible();
    await find.press('Escape');
  }
);

// Re-enable after the URL-sync follow-up adds cancellation of pending panel-editor imports.
// test('panel editor loading can be cancelled with browser Back', async ({ page, dashboardPath }) => {
//   const held = await holdChunk(page, /\/panel-edit\.[^/]+\.js$/);
//   await page.goto(dashboardPath);
//   await page.getByTestId('data-testid Panel header Review panel').hover();
//   await page.getByTestId('data-testid Panel menu Review panel').click();
//   await page.getByTestId('data-testid Panel menu item Edit').click();
//   await held.wait();
//   await expect(page).toHaveURL(/editPanel=/);
//   await page.goBack();
//   await expect(page).not.toHaveURL(/editPanel=/);
//   await held.release();
//   await expect(page.getByText('Browser review content')).toBeVisible();
//   await expect(page).not.toHaveURL(/editPanel=/);
//   await expect(page.getByTestId('data-testid Back to dashboard button')).toBeHidden();
// });

test('Filters pane shows the persisted filter key and value', { tag: '@behavior' }, async ({ page, dashboardPath }) => {
  await page.goto(dashboardPath);
  await page.getByRole('button', { name: 'Filters', exact: true }).click();
  await expect(page.getByText('Edit filters', { exact: true })).toBeVisible();
  await expect(page.getByText('environment', { exact: true }).last()).toBeVisible();
  await expect(page.getByText('production', { exact: true }).last()).toBeVisible();
});

test(
  'browser Back leaves the panel editor; Forward reopens it',
  { tag: '@behavior' },
  async ({ page, dashboardPath }) => {
    await page.goto(dashboardPath);
    await page.getByTestId('data-testid Panel header Review panel').hover();
    await page.getByTestId('data-testid Panel menu Review panel').click();
    await page.getByTestId('data-testid Panel menu item Edit').click();
    const backButton = page.getByTestId('data-testid Back to dashboard button');
    await expect(backButton).toBeVisible();
    await expect(page).toHaveURL(/editPanel=1/);
    await page.goBack();
    await expect(page.getByText('Browser review content')).toBeVisible();
    await expect(backButton).toBeHidden();
    await expect(page).not.toHaveURL(/editPanel=/);
    await page.goForward();
    await expect(backButton).toBeVisible();
    await expect(page).toHaveURL(/editPanel=1/);
  }
);

const addPaneChunk = /\/dashboard-add-new-pane\.[^/]+\.js$/;
const filtersPaneChunk = /\/dashboard-filters-overview\.[^/]+\.js$/;
const addControlsChunk = /\/dashboard-add-controls\.[^/]+\.js$/;

async function enterEditMode(page: Page, dashboardPath: string) {
  await page.goto(dashboardPath);
  await page.getByTestId('data-testid Edit dashboard button').click();
}

function collectPageErrors(page: Page, testInfo: TestInfo) {
  const errors: string[] = [];
  page.on('pageerror', (error) => {
    // The existing CorsWorker bootstrap fails on entering edit mode under CI's Trusted Types CSP,
    // before Options opens. Keep that exact worker error visible without masking renderer errors.
    if (
      error.message ===
        "Failed to execute 'importScripts' on 'WorkerGlobalScope': This document requires 'TrustedScriptURL' assignment." &&
      error.stack?.includes('\n    at blob:')
    ) {
      testInfo.annotations.push({ type: 'known-csp-worker-error', description: error.message });
    } else {
      errors.push(error.message);
    }
  });
  return errors;
}

test.describe('Options variable lists', { tag: '@options-flow' }, () => {
  test.beforeEach(async ({ page, dashboardUid }) => {
    const response = await page.request.get(`/api/dashboards/uid/${dashboardUid}`);
    expect(response.ok()).toBe(true);
    const { dashboard } = await response.json();
    dashboard.templating.list = [
      { name: 'TextVariable', type: 'textbox', query: 'initial', current: { text: 'initial', value: 'initial' } },
      { name: 'Region', type: 'custom', query: 'east,west', current: { text: 'east', value: 'east' } },
    ];
    const saved = await page.request.post('/api/dashboards/db', { data: { dashboard, overwrite: true } });
    expect(saved.ok(), await saved.text()).toBe(true);
  });

  test('cold Options mounts draggable variables and preserves edits and order across remounts', async ({
    page,
    dashboardPath,
  }, testInfo) => {
    const errors = collectPageErrors(page, testInfo);
    await enterEditMode(page, dashboardPath);
    const options = page.getByTestId('data-testid Dashboard Sidebar options button');
    await options.click();
    const variables = page.getByTestId('variables-list-visible');
    await expect(variables.getByTestId('variable-name')).toHaveText(['TextVariable', 'Region']);

    // A working keyboard drag proves the real drag-and-drop components replaced the loading stand-ins.
    const region = variables.getByRole('button', { name: 'Region', exact: true });
    await region.focus();
    await region.press('Space');
    await region.press('ArrowUp');
    await region.press('Space');
    await expect(variables.getByTestId('variable-name')).toHaveText(['Region', 'TextVariable']);

    const textVariable = variables
      .getByRole('listitem')
      .filter({ has: page.getByText('TextVariable', { exact: true }) });
    await textVariable.hover();
    await textVariable.getByRole('button', { name: 'Edit', exact: true }).click();
    await expect(page.getByLabel('Name', { exact: true })).toHaveValue('TextVariable');
    await page.getByRole('textbox', { name: 'Label Optional display name', exact: true }).fill('Updated text variable');
    await page.getByRole('textbox', { name: 'Label Optional display name', exact: true }).press('Tab');

    await options.click();
    await expect(variables.getByTestId('variable-name')).toHaveText(['Region', 'TextVariable']);
    await page.getByTestId('data-testid sidebar-show-hide-toggle').click();
    await expect(variables).toBeHidden();
    await page.getByTestId('data-testid sidebar-show-hide-toggle').click();
    await options.click();
    await expect(variables.getByTestId('variable-name')).toHaveText(['Region', 'TextVariable']);
    await textVariable.hover();
    await textVariable.getByRole('button', { name: 'Edit', exact: true }).click();
    await expect(page.getByRole('textbox', { name: 'Label Optional display name', exact: true })).toHaveValue(
      'Updated text variable'
    );
    await expect(page.getByTestId('TextPanel-converted-content')).toHaveText('Browser review content');
    expect(errors).toEqual([]);
  });

  test('exiting edit mode during the first Options load cancels it and allows reopening', async ({
    page,
    dashboardPath,
  }, testInfo) => {
    const errors = collectPageErrors(page, testInfo);
    const held = await holdChunk(page, /\/dashboard-edit-actions\.[^/]+\.js$/);
    await enterEditMode(page, dashboardPath);
    await page.getByTestId('data-testid Dashboard Sidebar options button').click();
    await held.wait();
    await page.getByRole('button', { name: 'Exit edit mode', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Enter edit mode', exact: true })).toBeVisible();
    await held.release();
    await expect(page.getByRole('button', { name: 'Enter edit mode', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'View all settings' })).toBeHidden();

    await page.getByTestId('data-testid Edit dashboard button').click();
    await page.getByTestId('data-testid Dashboard Sidebar options button').click();
    const variables = page.getByTestId('variables-list-visible');
    await expect(variables.getByTestId('variable-name')).toHaveText(['TextVariable', 'Region']);
    await expect(page.getByTestId('TextPanel-converted-content')).toHaveText('Browser review content');
    expect(errors).toEqual([]);
  });
});

for (const pane of ['Add', 'Filters'] as const) {
  test(`Options supersedes a pending ${pane} pane`, { tag: '@pane-request' }, async ({ page, dashboardPath }) => {
    const held = await holdChunk(page, pane === 'Add' ? addPaneChunk : filtersPaneChunk);
    await enterEditMode(page, dashboardPath);
    if (pane === 'Add') {
      await page.getByTestId('data-testid Dashboard Sidebar new button').click();
    } else {
      await page.getByRole('button', { name: 'Filters', exact: true }).click();
    }
    await held.wait();
    await page.getByTestId('data-testid Dashboard Sidebar options button').click();
    await expect(page.getByRole('button', { name: 'View all settings' })).toBeVisible();
    await held.release();
    await expect(page.getByRole('button', { name: 'View all settings' })).toBeVisible();
    await expect(page.getByTestId('data-testid sidebar add new panel')).toBeHidden();
    await expect(page.getByText('Edit filters', { exact: true })).toBeHidden();
  });
}

for (const order of ['older first', 'newer first'] as const) {
  test(
    `latest pane wins when two imports finish ${order}`,
    { tag: '@pane-request' },
    async ({ page, dashboardPath }) => {
      const add = await holdChunk(page, addPaneChunk);
      const filters = await holdChunk(page, filtersPaneChunk);
      await enterEditMode(page, dashboardPath);
      await page.getByTestId('data-testid Dashboard Sidebar new button').click();
      await add.wait();
      await page.getByRole('button', { name: 'Filters', exact: true }).click();
      await filters.wait();
      if (order === 'older first') {
        await add.release();
        await expect(page.getByTestId('data-testid sidebar add new panel')).toBeHidden();
        await filters.release();
      } else {
        await filters.release();
        await expect(page.getByText('Edit filters', { exact: true })).toBeVisible();
        await add.release();
      }
      await expect(page.getByText('Edit filters', { exact: true })).toBeVisible();
      await expect(page.getByText('environment', { exact: true }).last()).toBeVisible();
      await expect(page.getByTestId('data-testid sidebar add new panel')).toBeHidden();
    }
  );
}

test(
  'closing a loading sidebar prevents it reopening when its chunk arrives',
  { tag: '@pane-request' },
  async ({ page, dashboardPath, selectors }) => {
    const held = await holdChunk(page, addPaneChunk);
    await enterEditMode(page, dashboardPath);
    // Keep a pane open so closing is possible before loading placeholders are introduced.
    await page.getByTestId(selectors.pages.Dashboard.Sidebar.optionsButton).click();
    await expect(page.getByRole('button', { name: 'View all settings' })).toBeVisible();
    await page.getByTestId(selectors.pages.Dashboard.Sidebar.addButton).click();
    await held.wait();
    await page.getByText('Browser review content', { exact: true }).hover();
    await expect(page.getByRole('tooltip')).toBeHidden();
    await page.getByTestId(selectors.components.Sidebar.closePane).click();
    await expect(page.getByTestId(selectors.components.Sidebar.headerTitle)).toBeHidden();
    await held.release();
    await expect(page.getByTestId(selectors.components.Sidebar.headerTitle)).toBeHidden();
    await page.getByTestId(selectors.pages.Dashboard.Sidebar.addButton).click();
    await expect(page.getByTestId(selectors.components.Sidebar.headerTitle)).toHaveText('Add');
  }
);

for (const action of ['hide sidebar', 'exit edit mode'] as const) {
  test(`${action} cancels a pending Add pane`, { tag: '@pane-request' }, async ({ page, dashboardPath }) => {
    const held = await holdChunk(page, addPaneChunk);
    await enterEditMode(page, dashboardPath);
    await page.getByTestId('data-testid Dashboard Sidebar new button').click();
    await held.wait();
    if (action === 'hide sidebar') {
      await page.getByTestId('data-testid sidebar-show-hide-toggle').click();
    } else {
      await page.getByRole('button', { name: 'Exit edit mode', exact: true }).click();
      await expect(page.getByRole('button', { name: 'Enter edit mode', exact: true })).toBeVisible();
    }
    await held.release();
    if (action === 'hide sidebar') {
      await page.getByTestId('data-testid sidebar-show-hide-toggle').click();
      await expect(page.getByTestId('data-testid Dashboard Sidebar new button')).toBeVisible();
    } else {
      await expect(page.getByRole('button', { name: 'Enter edit mode', exact: true })).toBeVisible();
    }
    await expect(page.getByTestId('data-testid sidebar add new panel')).toBeHidden();
    await expect(page.getByTestId('TextPanel-converted-content')).toHaveText('Browser review content');
  });
}

for (const control of ['Variable', 'Filter and Group by', 'Annotation query', 'Link']) {
  test(`Options supersedes pending Add ${control}`, { tag: '@pane-request' }, async ({ page, dashboardPath }) => {
    const held = await holdChunk(page, addControlsChunk);
    await enterEditMode(page, dashboardPath);
    await page.getByTestId('data-testid ControlsAddButton trigger button').click();
    await page.getByRole('menuitem', { name: control, exact: true }).click();
    await held.wait();
    await page.getByTestId('data-testid Dashboard Sidebar options button').click();
    await expect(page.getByRole('button', { name: 'View all settings' })).toBeVisible();
    await held.release();
    await expect(page.getByRole('button', { name: 'View all settings' })).toBeVisible();
  });
}
