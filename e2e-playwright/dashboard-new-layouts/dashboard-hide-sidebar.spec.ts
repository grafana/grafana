import { test, expect } from '@grafana/plugin-e2e';

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
      await gotoDashboardPage({ uid: PAGE_UNDER_TEST });

      const container = page.getByTestId(selectors.components.Sidebar.container);
      await expect(container).toBeVisible();

      const hideButton = container.getByTestId(selectors.components.Sidebar.showHideToggle);
      await expect(hideButton).toBeVisible();
    });

    test('hide button is available in edit mode on desktop', async ({ gotoDashboardPage, selectors, page }) => {
      const dashboardPage = await gotoDashboardPage({ uid: PAGE_UNDER_TEST });

      await dashboardPage.getByGrafanaSelector(selectors.components.NavToolbar.editDashboard.editButton).click();

      const container = page.getByTestId(selectors.components.Sidebar.container);
      await expect(container).toBeVisible();

      const hideButton = container.getByTestId(selectors.components.Sidebar.showHideToggle);
      await expect(hideButton).toBeVisible();
    });

    test('clicking hide in view mode hides the sidebar and shows the toggle', async ({
      gotoDashboardPage,
      selectors,
      page,
    }) => {
      await gotoDashboardPage({ uid: PAGE_UNDER_TEST });

      const container = page.getByTestId(selectors.components.Sidebar.container);
      await container.getByTestId(selectors.components.Sidebar.showHideToggle).click();

      await expect(container).not.toBeVisible();
      // The show toggle (rendered when hidden) remains so the user can re-show
      await expect(page.getByTestId(selectors.components.Sidebar.showHideToggle)).toBeVisible();
    });

    test('clicking show re-displays the sidebar after hiding it', async ({ gotoDashboardPage, selectors, page }) => {
      await gotoDashboardPage({ uid: PAGE_UNDER_TEST });

      const container = page.getByTestId(selectors.components.Sidebar.container);
      await container.getByTestId(selectors.components.Sidebar.showHideToggle).click();
      await expect(container).not.toBeVisible();

      await page.getByTestId(selectors.components.Sidebar.showHideToggle).click();
      await expect(container).toBeVisible();
    });

    test('hidden state is shared between view mode and edit mode', async ({ gotoDashboardPage, selectors, page }) => {
      const dashboardPage = await gotoDashboardPage({ uid: PAGE_UNDER_TEST });

      // Hide in view mode
      const container = page.getByTestId(selectors.components.Sidebar.container);
      await container.getByTestId(selectors.components.Sidebar.showHideToggle).click();
      await expect(container).not.toBeVisible();

      // Enter edit mode — sidebar should still be hidden
      await dashboardPage.getByGrafanaSelector(selectors.components.NavToolbar.editDashboard.editButton).click();
      await expect(container).not.toBeVisible();
      await expect(page.getByTestId(selectors.components.Sidebar.showHideToggle)).toBeVisible();
    });

    test('selecting a panel while hidden temporarily shows the sidebar and de-selecting re-hides it', async ({
      gotoDashboardPage,
      selectors,
      page,
    }) => {
      const dashboardPage = await gotoDashboardPage({ uid: PAGE_UNDER_TEST });

      // Enter edit mode
      await dashboardPage.getByGrafanaSelector(selectors.components.NavToolbar.editDashboard.editButton).click();

      const container = page.getByTestId(selectors.components.Sidebar.container);
      await expect(container).toBeVisible();

      // Hide the sidebar
      await container.getByTestId(selectors.components.Sidebar.showHideToggle).click();
      await expect(container).not.toBeVisible();

      // Select a panel — sidebar should reappear temporarily
      const firstPanel = dashboardPage.getByGrafanaSelector(selectors.components.Panels.Panel.headerContainer).first();
      await firstPanel.click();

      await expect(container).toBeVisible();
      // The dock toggle is hidden during temp-show — the user shouldn't dock from this state
      await expect(container.getByTestId(selectors.components.Sidebar.dockToggle)).not.toBeVisible();

      // Close the pane (de-select) via the X button — sidebar should re-hide
      await container.getByTestId(selectors.components.Sidebar.closePane).click();

      await expect(container).not.toBeVisible();
      await expect(page.getByTestId(selectors.components.Sidebar.showHideToggle)).toBeVisible();
    });
  }
);
