import { test, expect } from '@grafana/plugin-e2e';

import testDashboard from '../dashboards/DataLinkWithoutSlugTest.json';

test.describe(
  'Dashboard with data links that have no slug',
  {
    tag: ['@dashboards'],
  },
  () => {
    let dashboardUID: string;

    test.beforeAll(async ({ request }) => {
      // Import the test dashboard
      const response = await request.post('/api/dashboards/import', {
        data: {
          dashboard: testDashboard,
          folderUid: '',
          overwrite: true,
          inputs: [],
        },
      });
      const responseBody = await response.json();
      dashboardUID = responseBody.uid;
    });

    test.afterAll(async ({ request }) => {
      // Clean up the imported dashboard
      if (dashboardUID) {
        await request.delete(`/api/dashboards/uid/${dashboardUID}`);
      }
    });

    test('Should not reload if linking to same dashboard', async ({ page, gotoDashboardPage, selectors }) => {
      const dashboardPage = await gotoDashboardPage({ uid: dashboardUID });

      const panel = dashboardPage.getByGrafanaSelector(
        selectors.components.Panels.Panel.title('Data links without slug')
      );
      await expect(panel).toBeVisible();

      const urlShouldContain = '/d/data-link-no-slug/data-link-without-slug-test';
      await dashboardPage
        .getByGrafanaSelector(selectors.components.DataLinksContextMenu.singleLink)
        .getByText(/9yy21uzzxypg/)
        .click();
      await expect(page.getByText(/Loading/)).toBeHidden();
      await expect(page).toHaveURL(new RegExp(urlShouldContain));

      await dashboardPage
        .getByGrafanaSelector(selectors.components.DataLinksContextMenu.singleLink)
        .getByText(/dr199bpvpcru/)
        .click();
      await expect(page.getByText(/Loading/)).toBeHidden();
      await expect(page).toHaveURL(new RegExp(urlShouldContain));

      await dashboardPage
        .getByGrafanaSelector(selectors.components.DataLinksContextMenu.singleLink)
        .getByText(/dre33fzyxcrz/)
        .click();
      await expect(page.getByText(/Loading/)).toBeHidden();
      await expect(page).toHaveURL(new RegExp(urlShouldContain));
    });
  }
);
