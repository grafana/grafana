import { test, expect } from '@grafana/plugin-e2e';

test.use({
  featureToggles: {
    dashboardNewLayouts: true,
  },
  viewport: { width: 375, height: 812 },
});

const PAGE_UNDER_TEST = 'kVi2Gex7z/test-variable-output';

test.describe('Mobile sidebar', { tag: ['@dashboards'] }, () => {
  test('hides sidebar by default in view mode', async ({ gotoDashboardPage, selectors, page }) => {
    await gotoDashboardPage({ uid: PAGE_UNDER_TEST });

    await expect(page.getByTestId(selectors.components.Sidebar.showHideToggle)).toBeVisible();
    await expect(page.getByTestId(selectors.components.Sidebar.container)).not.toBeVisible();
  });

  test('can show the sidebar and dock toggle is absent', async ({ gotoDashboardPage, selectors, page }) => {
    await gotoDashboardPage({ uid: PAGE_UNDER_TEST });

    await page.getByTestId(selectors.components.Sidebar.showHideToggle).click();

    await expect(page.getByTestId(selectors.components.Sidebar.container)).toBeVisible();
    await expect(page.getByTestId(selectors.components.Sidebar.dockToggle)).not.toBeVisible();
  });

  test('can hide the sidebar again after showing it', async ({ gotoDashboardPage, selectors, page }) => {
    await gotoDashboardPage({ uid: PAGE_UNDER_TEST });

    await page.getByTestId(selectors.components.Sidebar.showHideToggle).click();
    await expect(page.getByTestId(selectors.components.Sidebar.container)).toBeVisible();

    await page.getByTestId(selectors.components.Sidebar.showHideToggle).click();

    await expect(page.getByTestId(selectors.components.Sidebar.container)).not.toBeVisible();
    await expect(page.getByTestId(selectors.components.Sidebar.showHideToggle)).toBeVisible();
  });
});
