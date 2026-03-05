import { expect, test } from '@grafana/plugin-e2e';

const DASHBOARD_UID = 'ad7p5pj';

test.use({ viewport: { width: 2000, height: 1080 } });
test.describe('Panels test: Annotations', { tag: ['@panels', '@annotations'] }, () => {
  test('Should render panels', async ({ page, gotoDashboardPage, selectors }) => {
    const dashboardPage = await gotoDashboardPage({
      uid: DASHBOARD_UID,
      queryParams: new URLSearchParams(),
    });

    await expect(
      dashboardPage.getByGrafanaSelector(selectors.components.Panels.Panel.title('Time series'))
    ).toBeVisible();
  });
});
