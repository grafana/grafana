import { type Page } from '@playwright/test';

import { type DashboardPage, type E2ESelectorGroups, type Components } from '@grafana/plugin-e2e';

import { test, expect } from './fixtures';
import { Controls, Sidebar, Panels } from './page-objects';

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
    test('can edit panel title and description', async ({ gotoDashboardPage, page, controls, sidebar, panels }) => {
      await gotoDashboardPage({ uid: PAGE_UNDER_TEST });
      await controls.enterEditMode();

      const oldTitle = /^No Data Points Warning$/;
      await panels.selectByTitle(oldTitle);

      const titleInput = sidebar.panelOptions.getTitleInput();
      await expect(titleInput).toHaveValue(oldTitle);

      const newTitle = `New panel title (${Date.now()})`;
      await titleInput.fill(newTitle);

      const newDescription = `New panel description (${Date.now()})`;
      await sidebar.panelOptions.getDescriptionTextarea().fill(newDescription);

      await expect(panels.getHeader(oldTitle)).toBeHidden();

      const header = panels.getHeader(newTitle);
      await expect(header).toBeVisible();
    });

    test('can edit panel description', async ({ gotoDashboardPage, selectors, page, components }) => {
      const dashboardPage = await gotoDashboardPage({ uid: PAGE_UNDER_TEST });

      const { controls, panel, sidebar } = getTestObjects(page, dashboardPage, selectors, components);

      await controls.enterEditMode();

      await panel.selectByTitle(/^No Data Points Warning$/);

      const newDescription = `New panel description (${Date.now()})`;
      await sidebar.panelOptions.getDescriptionTextarea().fill(newDescription);

      const header = panel.getHeader(/^No Data Points Warning$/);

      // Reveal description tooltip and check that its value is as expected
      const descriptionIcon = header.locator('[data-testid="title-items-container"] > span').first();
      await descriptionIcon.hover();
      await expect(page.getByRole('tooltip')).toHaveText(newDescription);
    });

    test('can edit switch to subtitle description', async ({ gotoDashboardPage, selectors, page, components }) => {
      const dashboardPage = await gotoDashboardPage({ uid: PAGE_UNDER_TEST });

      const { controls, panel, sidebar } = getTestObjects(page, dashboardPage, selectors, components);

      await controls.enterEditMode();

      await panel.selectByTitle(/^No Data Points Warning$/);

      await sidebar.panelOptions.getDescriptionTextarea().fill('test description');
      await sidebar.panelOptions.getSubtitleSwitch().click();

      await expect(page.getByTestId(selectors.components.Panels.Panel.subtitle)).toContainText('test description');
    });
  }
);
function getTestObjects(
  page: Page,
  dashboardPage: DashboardPage,
  selectors: E2ESelectorGroups,
  components: Components
) {
  const controls = new Controls({
    page,
    getByGrafanaSelector: dashboardPage.getByGrafanaSelector.bind(dashboardPage),
    selectors,
    components,
  });
  const panel = new Panels({
    page,
    getByGrafanaSelector: dashboardPage.getByGrafanaSelector.bind(dashboardPage),
    selectors,
    components,
  });
  const sidebar = new Sidebar({
    page,
    getByGrafanaSelector: dashboardPage.getByGrafanaSelector.bind(dashboardPage),
    selectors,
    components,
  });
  return { controls, panel, sidebar };
}
