import { test, expect } from './fixtures';

test.use({
  featureToggles: {
    dashboardNewLayouts: true,
    dashboardUndoRedo: true,
    groupByVariable: true,
  },
});

test.describe(
  'Dashboard',
  {
    tag: ['@dashboards'],
  },
  () => {
    test('can change dashboard description and title', async ({ gotoDashboardPage, selectors, controls, sidebar }) => {
      const dashboardPage = await gotoDashboardPage({ uid: 'ed155665/annotation-filtering' });
      await controls.enterEditMode();
      await sidebar.toolbar.clickButton('Options');

      const titleInput = sidebar.dashboardOptions.getTitleInput();
      await expect(titleInput).toHaveValue('Annotation filtering');

      const newTitle = 'New dashboard title';
      await titleInput.fill(newTitle);
      await expect(titleInput).toHaveValue(newTitle);

      // check that new dashboard title is updated in the breadcrumbs
      await expect(
        dashboardPage.getByGrafanaSelector(selectors.components.Breadcrumbs.breadcrumb(newTitle))
      ).toBeVisible();

      const descriptionTextarea = sidebar.dashboardOptions.getDescriptionTextarea();
      await expect(descriptionTextarea).toHaveValue('');

      const newDescription = 'Dashboard description';
      await descriptionTextarea.fill(newDescription);
      await expect(descriptionTextarea).toHaveValue(newDescription);
    });
  }
);
