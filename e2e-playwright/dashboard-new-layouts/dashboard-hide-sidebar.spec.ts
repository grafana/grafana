import { test, expect } from '@grafana/plugin-e2e';

import { Controls, Panel, Sidebar } from './page-objects';

test.use({
  featureToggles: {
    dashboardNewLayouts: true,
  },
  viewport: { width: 1920, height: 1080 },
});

const PAGE_UNDER_TEST = '5SdHCadmz/panel-tests-graph';

test.describe(
  'Dashboard hide sidebar',
  {
    tag: ['@dashboards'],
  },
  () => {
    test('hide button is available in view mode on desktop', async ({ gotoDashboardPage, selectors, page }) => {
      const dashboardPage = await gotoDashboardPage({ uid: PAGE_UNDER_TEST });
      const sidebar = new Sidebar(page, dashboardPage, selectors);

      await expect(sidebar.getContainer()).toBeVisible();
      await expect(sidebar.toolbar.getVisibilityToggle()).toBeVisible();
    });

    test('hide button is available in edit mode on desktop', async ({ gotoDashboardPage, selectors, page }) => {
      const dashboardPage = await gotoDashboardPage({ uid: PAGE_UNDER_TEST });
      const controls = new Controls(page, dashboardPage, selectors);
      const sidebar = new Sidebar(page, dashboardPage, selectors);

      await controls.enterEditMode();

      await expect(sidebar.getContainer()).toBeVisible();
      await expect(sidebar.toolbar.getVisibilityToggle()).toBeVisible();
    });

    test('clicking hide in view mode hides the sidebar and shows the toggle', async ({
      gotoDashboardPage,
      selectors,
      page,
    }) => {
      const dashboardPage = await gotoDashboardPage({ uid: PAGE_UNDER_TEST });
      const sidebar = new Sidebar(page, dashboardPage, selectors);

      await sidebar.toolbar.getVisibilityToggle().click();

      await expect(sidebar.getContainer()).not.toBeVisible();
      // The show toggle (rendered when hidden) remains so the user can re-show
      await expect(sidebar.toolbar.getVisibilityToggle()).toBeVisible();
    });

    test('clicking show re-displays the sidebar after hiding it', async ({ gotoDashboardPage, selectors, page }) => {
      const dashboardPage = await gotoDashboardPage({ uid: PAGE_UNDER_TEST });
      const sidebar = new Sidebar(page, dashboardPage, selectors);

      await sidebar.toolbar.getVisibilityToggle().click();
      await expect(sidebar.getContainer()).not.toBeVisible();

      await sidebar.toolbar.getVisibilityToggle().click();
      await expect(sidebar.getContainer()).toBeVisible();
    });

    test('hidden state is shared between view mode and edit mode', async ({ gotoDashboardPage, selectors, page }) => {
      const dashboardPage = await gotoDashboardPage({ uid: PAGE_UNDER_TEST });
      const controls = new Controls(page, dashboardPage, selectors);
      const sidebar = new Sidebar(page, dashboardPage, selectors);

      // Hide in view mode
      await sidebar.toolbar.getVisibilityToggle().click();
      await expect(sidebar.getContainer()).not.toBeVisible();

      // Enter edit mode — sidebar should still be hidden
      await controls.enterEditMode();
      await expect(sidebar.getContainer()).not.toBeVisible();
      await expect(sidebar.toolbar.getVisibilityToggle()).toBeVisible();
    });

    test('selecting a panel while hidden temporarily shows the sidebar and de-selecting re-hides it', async ({
      gotoDashboardPage,
      selectors,
      page,
    }) => {
      const dashboardPage = await gotoDashboardPage({ uid: PAGE_UNDER_TEST });
      const controls = new Controls(page, dashboardPage, selectors);
      const sidebar = new Sidebar(page, dashboardPage, selectors);
      const panel = new Panel(page, dashboardPage, selectors);

      // Enter edit mode
      await controls.enterEditMode();

      await expect(sidebar.getContainer()).toBeVisible();

      // Hide the sidebar
      await sidebar.toolbar.getVisibilityToggle().click();
      await expect(sidebar.getContainer()).not.toBeVisible();

      // Select a panel — sidebar should reappear temporarily
      await panel.selectByTitle('No Data Points Warning');

      await expect(sidebar.getContainer()).toBeVisible();
      // The dock toggle is hidden during temp-show — the user shouldn't dock from this state
      await expect(sidebar.getDockToggle()).not.toBeVisible();

      // Close the pane (de-select) via the X button — sidebar should re-hide
      await sidebar.getCloseButton().click();

      await expect(sidebar.getContainer()).not.toBeVisible();
      await expect(sidebar.toolbar.getVisibilityToggle()).toBeVisible();
    });
  }
);
