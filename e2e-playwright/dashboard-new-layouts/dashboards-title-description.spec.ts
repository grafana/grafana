import { test, expect } from '@grafana/plugin-e2e';

test.use({
  featureToggles: {
    kubernetesDashboards: true,
    dashboardNewLayouts: true,
    groupByVariable: true,
  },
});

const PAGE_UNDER_TEST = 'ed155665/annotation-filtering';

test.describe(
  'Dashboard',
  {
    tag: ['@dashboards'],
  },
  () => {
    test('can change dashboard description and title', async ({ gotoDashboardPage, selectors, page }) => {
      const dashboardPage = await gotoDashboardPage({ uid: PAGE_UNDER_TEST });

      await dashboardPage.getByGrafanaSelector(selectors.components.NavToolbar.editDashboard.editButton).click();

      // Check that current dashboard title is visible in breadcrumb
      await expect(
        dashboardPage.getByGrafanaSelector(selectors.components.Breadcrumbs.breadcrumb('Annotation filtering'))
      ).toBeVisible();

      const titleInput = page.locator('[aria-label="dashboard-options Title field property editor"] input');
      await expect(titleInput).toHaveValue('Annotation filtering');
      await titleInput.fill('New dashboard title');
      await expect(titleInput).toHaveValue('New dashboard title');

      // Check that new dashboard title is reflected in breadcrumb
      await expect(
        dashboardPage.getByGrafanaSelector(selectors.components.Breadcrumbs.breadcrumb('New dashboard title'))
      ).toBeVisible();

      // Check that we can successfully change the dashboard description
      const descriptionTextArea = page.locator(
        '[aria-label="dashboard-options Description field property editor"] textarea'
      );
      await descriptionTextArea.fill('Dashboard description');
      await expect(descriptionTextArea).toHaveValue('Dashboard description');
    });
  }
);
