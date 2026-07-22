import { test, expect } from '@grafana/plugin-e2e';

import { Controls, Panel, Sidebar } from './page-objects';

test.use({
  featureToggles: {
    dashboardNewLayouts: true,
    dashboardUndoRedo: true,
    groupByVariable: true,
  },
});

const PAGE_UNDER_TEST = '5SdHCadmz/panel-tests-graph';

test.describe(
  'Dashboard edit - Panel title and description',
  {
    tag: ['@dashboards'],
  },
  () => {
    test('can edit panel title', async ({ gotoDashboardPage, selectors, page }) => {
      const dashboardPage = await gotoDashboardPage({ uid: PAGE_UNDER_TEST });

      const controls = new Controls(page, dashboardPage, selectors);
      const panel = new Panel(page, dashboardPage, selectors);
      const sidebar = new Sidebar(page, dashboardPage, selectors);

      await controls.enterEditMode();

      const oldTitle = /^No Data Points Warning$/;
      await panel.selectByTitle(oldTitle);

      const titleInput = sidebar.panelOptions.getTitleInput();
      await expect(titleInput).toHaveValue(oldTitle);

      const newTitle = `New panel title (${Date.now()})`;
      await titleInput.fill(newTitle);

      await expect(panel.getHeaderByTitle(oldTitle)).toBeHidden();

      const header = panel.getHeaderByTitle(newTitle);
      await expect(header).toBeVisible();
    });

    test('can edit panel description', async ({ gotoDashboardPage, selectors, page }) => {
      const dashboardPage = await gotoDashboardPage({ uid: PAGE_UNDER_TEST });

      const controls = new Controls(page, dashboardPage, selectors);
      const panel = new Panel(page, dashboardPage, selectors);
      const sidebar = new Sidebar(page, dashboardPage, selectors);

      await controls.enterEditMode();

      await panel.selectByTitle(/^No Data Points Warning$/);

      const newDescription = `New panel description (${Date.now()})`;
      await sidebar.panelOptions.getDescriptionTextarea().fill(newDescription);

      const header = panel.getHeaderByTitle(/^No Data Points Warning$/);

      // Reveal description tooltip and check that its value is as expected
      const descriptionIcon = header.locator('[data-testid="title-items-container"] > span').first();
      await descriptionIcon.hover();
      await expect(page.getByRole('tooltip')).toHaveText(newDescription);
    });

    test('can edit switch to subtitle description', async ({ gotoDashboardPage, selectors, page }) => {
      const dashboardPage = await gotoDashboardPage({ uid: PAGE_UNDER_TEST });

      const controls = new Controls(page, dashboardPage, selectors);
      const panel = new Panel(page, dashboardPage, selectors);
      const sidebar = new Sidebar(page, dashboardPage, selectors);

      await controls.enterEditMode();

      await panel.selectByTitle(/^No Data Points Warning$/);

      await sidebar.panelOptions.getDescriptionTextarea().fill('test description');
      await sidebar.panelOptions.getSubtitleSwitch().click();

      await expect(page.getByTestId(selectors.components.Panels.Panel.subtitle)).toContainText('test description');
    });
  }
);
