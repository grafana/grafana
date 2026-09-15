import test, { expect, type Locator, type Page } from '@playwright/test';

import { type DashboardPage, type E2ESelectorGroups } from '@grafana/plugin-e2e';

import { type Tabs, type Panels, type Rows } from '../page-objects';

/**
 * Reusable assertion bundles built on page-object locators (and occasional
 * save-drawer chrome not yet owned by a page object).
 *
 * An assertion helper IS a multi-step or multi-element `expect` sequence that
 * several specs need verbatim (e.g. "all repeated panel titles visible").
 *
 * An assertion helper is NOT:
 * - a single `expect` — leave that in the spec;
 * - a user interaction or locator lookup — that belongs to a page object;
 * - a multi-step setup/navigation flow — that belongs in `flows.ts`;
 * - drag-and-drop / `boundingBox()` geometry — that belongs in `utils.ts`.
 *
 * Add a new helper only when a second spec needs the same bundle.
 */
export async function expectRepeatedPanelTitlesToBe(
  panels: Panels,
  title: string,
  values: Array<string | number>,
  state: 'visible' | 'hidden' = 'visible'
) {
  await test.step(`Expect repeated panel titles to be ${state}`, async () => {
    for (const value of values) {
      if (state === 'visible') {
        await expect(panels.getPanel(`${title}${value}`)).toBeVisible();
      } else {
        await expect(panels.getPanel(`${title}${value}`)).toBeHidden();
      }
    }
  });
}

export async function expectRepeatedRowTitlesToBe(
  rows: Rows,
  title: string,
  values: Array<string | number>,
  state: 'visible' | 'hidden' = 'visible'
) {
  await test.step(`Expect repeated row titles to be ${state}`, async () => {
    for (const value of values) {
      if (state === 'visible') {
        await expect(rows.getTitle(`${title}${value}`)).toBeVisible();
      } else {
        await expect(rows.getTitle(`${title}${value}`)).toBeHidden();
      }
    }
  });
}

export async function expectRepeatedTabTitlesToBe(
  tabs: Tabs,
  title: string,
  values: Array<string | number>,
  state: 'visible' | 'hidden' = 'visible'
) {
  await test.step(`Expect repeated tab titles to be ${state}`, async () => {
    for (const value of values) {
      if (state === 'visible') {
        await expect(tabs.getTitle(`${title}${value}`)).toBeVisible();
      } else {
        await expect(tabs.getTitle(`${title}${value}`)).toBeHidden();
      }
    }
  });
}

// Asserts the tab title and content visibility
export async function expectTabVisibility(
  tabTitle: string,
  tabs: Tabs,
  visibility: 'visible' | 'hidden'
): Promise<{
  title: Locator;
  content: Locator;
}> {
  return test.step(`Expect tab "${tabTitle}" to be ${visibility}`, async () => {
    const title = tabs.getTitle(tabTitle);
    const content = tabs.getContent(tabTitle);

    if (visibility === 'visible') {
      await expect(title).toBeVisible();
      await expect(content).toBeVisible();
    } else {
      await expect(title).not.toBeVisible();
      await expect(content).not.toBeVisible();
    }

    return { title, content };
  });
}

// Asserts the row title and content visibility
export async function expectRowVisibility(
  rowTitle: string,
  rows: Rows,
  visibility: 'visible' | 'hidden'
): Promise<{
  title: Locator;
  content: Locator;
}> {
  return test.step(`Expect row "${rowTitle}" to be ${visibility}`, async () => {
    const title = rows.getTitle(rowTitle);
    const content = rows.getContent(rowTitle);

    if (visibility === 'visible') {
      await expect(title).toBeVisible();
      await expect(content).toBeVisible();
    } else {
      await expect(title).not.toBeVisible();
      await expect(content).not.toBeVisible();
    }

    return { title, content };
  });
}

export async function expectDashboardChangesToContain(
  dashboardPage: DashboardPage,
  page: Page,
  selectors: E2ESelectorGroups,
  changeText: string
) {
  await test.step('Expect JSON diff in save drawer to contain text', async () => {
    await dashboardPage.getByGrafanaSelector(selectors.components.NavToolbar.editDashboard.saveButton).click();

    await dashboardPage.getByGrafanaSelector(selectors.components.Tab.title('Changes')).click();

    // The Monaco diff editor virtualizes its DOM, so assert against the loaded text models
    // instead of the rendered text
    await expect(page.locator('.monaco-diff-editor')).toBeVisible();
    await expect
      .poll(() =>
        page.evaluate(
          (text) => window.monaco.editor.getModels().some((model) => model.getValue().includes(text)),
          changeText
        )
      )
      .toBe(true);

    await dashboardPage.getByGrafanaSelector(selectors.components.Drawer.General.close).click();
  });
}
