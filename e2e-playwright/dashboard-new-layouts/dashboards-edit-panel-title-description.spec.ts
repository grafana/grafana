import { test, expect } from '@grafana/plugin-e2e';

import { flows } from './utils';

test.use({
  featureToggles: {
    kubernetesDashboards: true,
    dashboardNewLayouts: true,
    groupByVariable: true,
  },
});

const PAGE_UNDER_TEST = '5SdHCadmz/panel-tests-graph';

test.describe(
  'Dashboard',
  {
    tag: ['@dashboards'],
  },
  () => {
    test('can edit panel title and description', async ({ gotoDashboardPage, selectors, page }) => {
      const dashboardPage = await gotoDashboardPage({ uid: PAGE_UNDER_TEST });

      await dashboardPage.getByGrafanaSelector(selectors.components.NavToolbar.editDashboard.editButton).click();

      const oldTitle = 'No Data Points Warning';
      const firstPanelTitle = dashboardPage
        .getByGrafanaSelector(selectors.components.Panels.Panel.headerContainer)
        .first()
        .locator('h2')
        .first();
      await expect(firstPanelTitle).toHaveText(oldTitle);

      const newDescription = 'A description of this panel';
      await flows.changePanelDescription(dashboardPage, selectors, oldTitle, newDescription);

      const newTitle = 'New Panel Title';
      await flows.changePanelTitle(dashboardPage, selectors, oldTitle, newTitle);

      // Check that new title is reflected in panel header
      const updatedPanelTitle = dashboardPage
        .getByGrafanaSelector(selectors.components.Panels.Panel.headerContainer)
        .first()
        .locator('h2')
        .first();
      await expect(updatedPanelTitle).toHaveText(newTitle);

      // Reveal description tooltip and check that its value is as expected
      const descriptionIcon = page.locator('[data-testid="title-items-container"] > span').first();
      await descriptionIcon.click({ force: true });

      // Get the tooltip ID from the aria-describedby attribute
      const tooltipId = await descriptionIcon.getAttribute('aria-describedby');
      await expect(async () => {
        const tooltip = page.locator(`[id="${tooltipId}"]`);
        await expect(tooltip).toHaveText(`${newDescription}\n`);
      }).toPass();
    });
  }
);
