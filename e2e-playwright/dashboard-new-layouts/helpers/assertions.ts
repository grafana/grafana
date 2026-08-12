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

// Asserts the tab title and content are visible, and returns the content
// locator so the caller can scope further lookups to it
export async function expectTabToBeVisible(tabTitle: string, tabs: Tabs): Promise<Locator> {
  return test.step(`Expect tab "${tabTitle}" to be visible`, async () => {
    await expect(tabs.getTitle(tabTitle)).toBeVisible();

    const tabContent = tabs.getContent(tabTitle);
    await expect(tabContent).toBeVisible();

    return tabContent;
  });
}

// Asserts the row title and content are visible, and returns the content
// locator so the caller can scope further lookups to it
export async function expectRowToBeVisible(rowTitle: string, rows: Rows): Promise<Locator> {
  return test.step(`Expect row "${rowTitle}" to be visible`, async () => {
    await expect(rows.getTitle(rowTitle)).toBeVisible();

    const rowContent = rows.getContent(rowTitle);
    await expect(rowContent).toBeVisible();

    return rowContent;
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
    await expect(page.getByText('Full JSON diff').locator('..')).toContainText(changeText);

    await dashboardPage.getByGrafanaSelector(selectors.components.Drawer.General.close).click();
  });
}
