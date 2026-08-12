import { type Locator, type Page } from '@playwright/test';

import { type DashboardPage, type E2ESelectorGroups, expect, test } from '@grafana/plugin-e2e';

import type { Panels, Rows, Tabs } from '../page-objects';

/**
 * Coordinate-based drag: hover the source, press, move in steps, release.
 * Playwright's locator.dragTo() does not trigger the dnd library (pangea) used by
 * tabs/rows, which requires intermediate mousemove events.
 */
export async function dragTo(
  page: Page,
  sourceName: string,
  source: Locator,
  toX: number,
  toY: number,
  options?: { steps?: number }
) {
  await test.step(`Drag ${sourceName} to (${toX}, ${toY})`, async () => {
    await source.hover();
    await page.mouse.down();
    await page.mouse.move(toX, toY, { steps: options?.steps ?? 5 });
    await page.mouse.up();
  });
}

export async function getPanelBox(
  panels: Panels,
  panelTitle: string
): Promise<{ x: number; y: number; width: number; height: number }> {
  // boundingBox() is a point-in-time snapshot and stays out of page objects;
  // measures the whole panel <section>, matched exactly by testid
  const boundingBox = await panels.getPanel(panelTitle).boundingBox();
  expect(boundingBox, `Panel "${panelTitle}" should have a bounding box`).not.toBeNull();

  return boundingBox!;
}

export async function movePanel(panels: Panels, sourcePanel: string | RegExp, targetPanel: string | RegExp) {
  await test.step(`Move panel "${sourcePanel}" onto "${targetPanel}"`, async () => {
    // Perform drag and drop; pixel-sensitive mechanics stay out of page objects
    await panels.getHeader(sourcePanel).dragTo(panels.getHeader(targetPanel));
  });
}

export async function getTabBox(
  tabs: Tabs,
  tabTitle: string
): Promise<{ x: number; y: number; width: number; height: number }> {
  const tab = tabs.getTitle(tabTitle).first();
  await expect(tab).toBeVisible();
  const boundingBox = await tab.boundingBox();
  return boundingBox!;
}

export async function moveTab(page: Page, tabs: Tabs, sourceTab: string, targetTab: string) {
  await test.step(`Move tab "${sourceTab}" onto "${targetTab}"`, async () => {
    const targetBox = await getTabBox(tabs, targetTab);
    const sourceTabElement = tabs.getTitle(sourceTab).first();

    // Perform drag and drop (dragTo() did not work in this case)
    await sourceTabElement.hover();
    await page.mouse.down();
    // move to adjusted target position (relative to top left)
    await page.mouse.move(targetBox.x + targetBox.width, targetBox.y, { steps: 5 });
    await page.mouse.up();
  });
}

export async function getRowBox(
  dashboardPage: DashboardPage,
  selectors: E2ESelectorGroups,
  rowTitle: string
): Promise<{ x: number; y: number; width: number; height: number }> {
  const row = dashboardPage.getByGrafanaSelector(selectors.components.DashboardRow.wrapper(rowTitle)).first();
  await expect(row).toBeVisible();
  const boundingBox = await row.boundingBox();
  return boundingBox!;
}

export async function moveRow(
  page: Page,
  dashboardPage: DashboardPage,
  rows: Rows,
  selectors: E2ESelectorGroups,
  sourceRow: string,
  targetRow: string
) {
  const targetBox = await getRowBox(dashboardPage, selectors, targetRow);

  // drop below the target row (relative to top left)
  await dragTo(
    page,
    `row "${sourceRow}"`,
    rows.getTitle(sourceRow).first(),
    targetBox.x,
    targetBox.y + targetBox.height
  );
}

export async function undockMegaMenu(dashboardPage: DashboardPage, selectors: E2ESelectorGroups) {
  await test.step('Undock the mega menu', async () => {
    await dashboardPage
      .getByGrafanaSelector(selectors.components.NavMenu.Menu)
      .getByRole('button', { name: 'Undock menu' })
      .click();
  });
}
