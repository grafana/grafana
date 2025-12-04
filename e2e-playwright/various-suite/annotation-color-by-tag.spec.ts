import { test, expect } from '@grafana/plugin-e2e';

test.describe(
  'Annotation color by tags',
  {
    tag: ['@various'],
  },
  () => {
    const DASHBOARD_ID = 'ed155665';

    test('Color by tags input is visible and can be edited', async ({ page, selectors, gotoDashboardPage }) => {
      const dashboardPage = await gotoDashboardPage({ uid: DASHBOARD_ID });

      const editButton = dashboardPage.getByGrafanaSelector(selectors.components.NavToolbar.editDashboard.editButton);
      await expect(editButton).toBeVisible();
      await editButton.click();

      const settingsButton = dashboardPage.getByGrafanaSelector(
        selectors.components.NavToolbar.editDashboard.settingsButton
      );
      await expect(settingsButton).toBeVisible();
      await settingsButton.click();

      const annotationsTab = dashboardPage.getByGrafanaSelector(selectors.components.Tab.title('Annotations'));
      await annotationsTab.click();

      const newQueryButton = page.getByText('New query');
      await newQueryButton.click();

      const nameInput = dashboardPage.getByGrafanaSelector(
        selectors.pages.Dashboard.Settings.Annotations.Settings.name
      );
      await nameInput.fill('Color by tags test');

      const colorByTagsInput = dashboardPage.getByGrafanaSelector(
        selectors.pages.Dashboard.Settings.Annotations.NewAnnotation.colorByTags
      );
      await expect(colorByTagsInput).toBeVisible();

      await expect(colorByTagsInput).toHaveValue('');

      await colorByTagsInput.fill('critical, warning, info');

      await expect(colorByTagsInput).toHaveValue('critical, warning, info');

      await colorByTagsInput.fill('');

      await expect(colorByTagsInput).toHaveValue('');
    });
  }
);
