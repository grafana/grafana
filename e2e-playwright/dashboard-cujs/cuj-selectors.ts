import { Page } from '@playwright/test';

import { expect, DashboardPage, E2ESelectorGroups } from '@grafana/plugin-e2e';

export function getAdHocFilterPills(page: Page) {
  return page.getByLabel(/^Edit filter with key/);
}

export async function waitForAdHocOption(page: Page) {
  await page.waitForSelector('[role="option"]', { state: 'visible' });
}

export async function getMarkdownHTMLContent(page: DashboardPage, selectors: E2ESelectorGroups) {
  const panelContent = page.getByGrafanaSelector(selectors.components.Panels.Panel.content).first();
  await expect(panelContent).toBeVisible();
  return panelContent.locator('.markdown-html');
}

export function getAdhocFiltersInput(page: DashboardPage, selectors: E2ESelectorGroups) {
  return page
    .getByGrafanaSelector(selectors.pages.Dashboard.SubMenu.submenuItemLabels('adHoc'))
    .locator('..')
    .locator('input');
}

export function getGroupByInput(page: DashboardPage, selectors: E2ESelectorGroups) {
  return page
    .getByGrafanaSelector(selectors.pages.Dashboard.SubMenu.submenuItemLabels('groupBy'))
    .locator('..')
    .locator('input');
}

export function getAdHocFilterOptionValues(page: Page) {
  return page.getByTestId(/^data-testid ad hoc filter option value/);
}

export function getAdHocFilterRestoreButton(page: Page, type: string) {
  if (type === 'dashboard') {
    return page.getByLabel('Restore the value set by this dashboard.');
  }

  if (type === 'scope') {
    return page.getByLabel('Restore the value set by your selected scope.');
  }

  return page.getByLabel('Restore filter to its original value.');
}

export function getGroupByRestoreButton(page: Page) {
  return page.getByLabel('Restore groupby set by this dashboard.');
}

export function getScopesSelectorInput(page: Page) {
  return page.getByTestId('scopes-selector-input');
}

export function getRecentScopesSelector(page: Page) {
  return page.getByTestId('scopes-selector-recent-scopes-section');
}

export function getScopeTreeCheckboxes(page: Page) {
  return page.locator('input[type="checkbox"][data-testid^="scopes-tree"]');
}

export function getScopesDashboards(page: Page) {
  return page.locator('[data-testid^="scopes-dashboards-"][role="treeitem"]');
}

export function getScopesDashboardsGroupExpand(page: Page) {
  // Match folder expand buttons (scopes-dashboards-{title}-expand) but NOT the drawer toggle (scopes-dashboards-expand)
  return page.locator(
    '[data-testid$="-expand"][data-testid^="scopes-dashboards-"]:not([data-testid="scopes-dashboards-expand"])'
  );
}

/**
 * Clicks the first available dashboard in the scopes dashboard list.
 * If dashboards are in collapsed groups, expands the first group first.
 */
export async function clickFirstScopesDashboard(page: Page) {
  const dashboards = getScopesDashboards(page);
  const groupExpand = getScopesDashboardsGroupExpand(page);

  // Check if there's a visible dashboard item
  const visibleDashboard = dashboards.first();
  if (await visibleDashboard.isVisible({ timeout: 1000 }).catch(() => false)) {
    await visibleDashboard.click();
    return;
  }

  // If no visible dashboard, try expanding the first group
  const firstGroup = groupExpand.first();
  if (await firstGroup.isVisible({ timeout: 5000 })) {
    await firstGroup.click();
    // Wait for the group to expand and dashboard items to appear
    await dashboards.first().waitFor({ state: 'visible', timeout: 5000 });
    await dashboards.first().click();
  }
}

export function getScopesDashboardsSearchInput(page: Page) {
  return page.getByTestId('scopes-dashboards-search');
}

export function getGroupByValues(page: Page) {
  return page
    .getByTestId(/^GroupBySelect-/)
    .first()
    .locator('div:has(+ button)');
}

export function getGroupByOptions(page: Page) {
  return page.getByTestId('data-testid Select option');
}
