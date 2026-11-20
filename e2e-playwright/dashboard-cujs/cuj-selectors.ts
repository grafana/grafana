import { type Page } from '@playwright/test';

import { expect, type DashboardPage, type E2ESelectorGroups } from '@grafana/plugin-e2e';

export function getAdHocFilterPills(page: Page) {
  return page.getByLabel(/^Edit filter with key/);
}

// The unified filters control collapses pills that don't fit on one line
export async function expandAdHocFilters(page: Page) {
  const showMore = page.getByRole('button', { name: /^Show \d+ more filters$/ });
  if (await showMore.isVisible()) {
    await showMore.click();
  }
}

export async function waitForAdHocOption(page: Page) {
  await page.waitForSelector('[role="option"]', { state: 'visible' });
}

export async function getMarkdownHTMLContent(page: DashboardPage, selectors: E2ESelectorGroups) {
  const panelContent = page.getByGrafanaSelector(selectors.components.Panels.Panel.content).first();
  await expect(panelContent).toBeVisible();
  return panelContent.locator('.markdown-html');
}

function getAdHocControl(page: DashboardPage, selectors: E2ESelectorGroups) {
  return page.getByGrafanaSelector(selectors.pages.Dashboard.SubMenu.submenuItemLabels('adHoc')).locator('..');
}

// The filters inputs (pill being edited, then the new-filter input) render before the group by input
export function getAdhocFiltersInput(page: DashboardPage, selectors: E2ESelectorGroups) {
  return getAdHocControl(page, selectors).locator('input').first();
}

export function getGroupByInput(page: DashboardPage, selectors: E2ESelectorGroups) {
  return getAdHocControl(page, selectors).getByPlaceholder('+ key');
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

/**
 * Clicks the first available dashboard in the scopes dashboard list.
 */
export async function clickFirstScopesDashboard(page: Page) {
  const dashboards = getScopesDashboards(page);
  // Wait for at least one dashboard to be visible
  await expect(dashboards.first()).toBeVisible({ timeout: 10000 });
  // Click - Playwright will automatically wait for the element to be actionable
  await dashboards.first().click();
}

export function getScopesDashboardsSearchInput(page: Page) {
  return page.getByTestId('scopes-dashboards-search');
}

export function getGroupByPills(page: Page) {
  return page.getByRole('button', { name: /^Group by / });
}

export async function expectGroupByInUrl(page: Page, key: string) {
  await expect.poll(() => new URL(page.url()).searchParams.getAll('var-adHoc')).toContain(`${key}|groupBy`);
}
