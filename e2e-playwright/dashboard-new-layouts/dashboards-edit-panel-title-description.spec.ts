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
    test('can edit panel title and description', async ({ gotoDashboardPage, selectors, page, components }) => {
      const dashboardPage = await gotoDashboardPage({ uid: PAGE_UNDER_TEST });

      const controls = new Controls({ page, dashboardPage, selectors, components });
      const panel = new Panel({ page, dashboardPage, selectors, components });
      const sidebar = new Sidebar({ page, dashboardPage, selectors, components });

      await controls.enterEditMode();

      const oldTitle = /^No Data Points Warning$/;
      await panel.selectByTitle(oldTitle);

      const titleInput = sidebar.panelOptions.getTitleInput();
      await expect(titleInput).toHaveValue(oldTitle);

      const newTitle = `New panel title (${Date.now()})`;
      await titleInput.fill(newTitle);

      const newDescription = `New panel description (${Date.now()})`;
      await sidebar.panelOptions.getDescriptionTextarea().fill(newDescription);

      await expect(panel.getHeaderByTitle(oldTitle)).toBeHidden();

      const header = panel.getHeaderByTitle(newTitle);
      await expect(header).toBeVisible();

      // Reveal description tooltip and check that its value is as expected
      const descriptionIcon = header.locator('[data-testid="title-items-container"] > span').first();
      await descriptionIcon.hover();
      await expect(page.getByRole('tooltip')).toHaveText(newDescription);
    });
  }
);
