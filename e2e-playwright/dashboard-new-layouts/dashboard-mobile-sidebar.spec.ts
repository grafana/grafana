import { test, expect } from '@grafana/plugin-e2e';

import { Sidebar } from './page-objects';

test.use({
  featureToggles: {
    dashboardNewLayouts: true,
  },
  viewport: { width: 375, height: 812 },
});

const PAGE_UNDER_TEST = 'kVi2Gex7z/test-variable-output';

test.describe('Mobile sidebar', { tag: ['@dashboards'] }, () => {
  test('can show and hide the sidebar on-demand (hidden by default)', async ({
    gotoDashboardPage,
    selectors,
    page,
    components,
  }) => {
    const dashboardPage = await gotoDashboardPage({ uid: PAGE_UNDER_TEST });
    const sidebar = new Sidebar({ page, dashboardPage, selectors, components });

    await expect(sidebar.getContainer()).not.toBeVisible();
    await expect(sidebar.toolbar.getVisibilityToggle()).toBeVisible();

    await sidebar.toolbar.getVisibilityToggle().click();

    await expect(sidebar.getContainer()).toBeVisible();
    await expect(sidebar.toolbar.getVisibilityToggle()).toBeVisible();

    await sidebar.toolbar.getVisibilityToggle().click();

    await expect(sidebar.getContainer()).not.toBeVisible();
    await expect(sidebar.toolbar.getVisibilityToggle()).toBeVisible();
  });
});
