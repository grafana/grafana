import { test, expect } from './fixtures';

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

      // Reveal description tooltip and check that its value is as expected
      const descriptionIcon = header.locator('[data-testid="title-items-container"] > span').first();
      await descriptionIcon.hover();
      await expect(page.getByRole('tooltip')).toHaveText(newDescription);
    });
  }
);
