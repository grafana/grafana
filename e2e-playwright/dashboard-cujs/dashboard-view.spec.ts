import { test, expect } from '@grafana/plugin-e2e';

import scopesDashboardOne from '../dashboards/scopes-cujs/scopeDashboardOne.json';

test.use({
  featureToggles: {
    scopeFilters: true,
    groupByVariable: true,
    reloadDashboardsOnParamsChange: true,
  },
});

const USE_LIVE_DATA = Boolean(process.env.USE_LIVE_DATA);
const LIVE_DASHBOARD_UID = process.env.LIVE_DASHBOARD_UID;

export const DASHBOARD = USE_LIVE_DATA && LIVE_DASHBOARD_UID ? LIVE_DASHBOARD_UID : 'scopes-dashboard-1';
export const PANEL_UNDER_TEST = 'Panel Title';

test.describe(
  'Dashboard view CUJs',
  {
    tag: ['@dashview-cujs'],
  },
  () => {
    let dashboardUIDs: string[] = [];

    test.beforeAll(async ({ request }) => {
      // Import the test dashboard
      for (const dashboard of [scopesDashboardOne]) {
        let response = await request.post('/api/dashboards/import', {
          data: {
            dashboard,
            folderUid: '',
            overwrite: true,
            inputs: [],
          },
        });
        let responseBody = await response.json();
        dashboardUIDs.push(responseBody.uid);
      }
    });

    test.afterAll(async ({ request }) => {
      // Clean up the imported dashboard
      for (const dashboardUID of dashboardUIDs) {
        await request.delete(`/api/dashboards/uid/${dashboardUID}`);
      }
    });

    test('View a dashboard', async ({ page, gotoDashboardPage, selectors }) => {
      await test.step('1.Top level selectors', async () => {
        const dashboardPage = await gotoDashboardPage({ uid: DASHBOARD });

        const groupByVariable = dashboardPage.getByGrafanaSelector(
          selectors.pages.Dashboard.SubMenu.submenuItemLabels('groupBy')
        );

        const adHocVariable = dashboardPage.getByGrafanaSelector(
          selectors.pages.Dashboard.SubMenu.submenuItemLabels('adHoc')
        );

        expect(groupByVariable).toBeVisible();
        expect(adHocVariable).toBeVisible();
      });

      await test.step('2.View widgets/chargs in fullscreen mode', async () => {
        const dashboardPage = await gotoDashboardPage({ uid: DASHBOARD });

        const viewPanelBreadcrumb = dashboardPage.getByGrafanaSelector(
          selectors.components.Breadcrumbs.breadcrumb('View panel')
        );

        await expect(viewPanelBreadcrumb).not.toBeVisible();

        const panelTitle = dashboardPage.getByGrafanaSelector(
          selectors.components.Panels.Panel.title(PANEL_UNDER_TEST)
        );
        await expect(panelTitle).toBeVisible();
        // Open panel menu and click edit
        await panelTitle.hover();
        await dashboardPage.getByGrafanaSelector(selectors.components.Panels.Panel.menu(PANEL_UNDER_TEST)).click();
        await dashboardPage.getByGrafanaSelector(selectors.components.Panels.Panel.menuItems('View')).click();

        await expect(viewPanelBreadcrumb).toBeVisible();

        await dashboardPage
          .getByGrafanaSelector(selectors.components.NavToolbar.editDashboard.backToDashboardButton)
          .click();

        await expect(viewPanelBreadcrumb).not.toBeVisible();
      });

      await test.step('3.Set time range for the dashboard', async () => {
        const dashboardPage = await gotoDashboardPage({ uid: DASHBOARD });

        const timePickerButton = dashboardPage.getByGrafanaSelector(selectors.components.TimePicker.openButton);

        await test.step('3.1.Click on Quick range', async () => {
          expect.soft(await timePickerButton.textContent()).toContain('Last 6 hours');
          await timePickerButton.click();

          const label = page.getByText('Last 5 minutes');
          await label.click();

          expect.soft(await timePickerButton.textContent()).toContain('Last 5 minutes');
        });

        await test.step('3.2.Absolute time range', async () => {
          await timePickerButton.click();
          await dashboardPage
            .getByGrafanaSelector(selectors.components.TimePicker.fromField)
            .fill('2024-01-01 00:00:00');
          await dashboardPage.getByGrafanaSelector(selectors.components.TimePicker.toField).fill('2024-01-01 23:59:59');
          await dashboardPage.getByGrafanaSelector(selectors.components.TimePicker.applyTimeRange).click();

          expect.soft(await timePickerButton.textContent()).toContain('2024-01-01 00:00:00 to 2024-01-01 23:59:59');
        });

        await test.step('3.3.Change time zone', async () => {
          await timePickerButton.click();
          await dashboardPage
            .getByGrafanaSelector(selectors.components.TimeZonePicker.changeTimeSettingsButton)
            .click();

          const timeZoneSelectionArea = page.locator('section[aria-label="Time zone selection"]');
          expect(timeZoneSelectionArea).toBeVisible();
          expect(await timeZoneSelectionArea.textContent()).toContain('Browser Time');

          await dashboardPage.getByGrafanaSelector(selectors.components.TimeZonePicker.containerV2).click();
          const label = page.getByText('Coordinated Universal Time');
          await label.click();

          expect(await timeZoneSelectionArea.textContent()).toContain('Coordinated Universal Time');
          await timePickerButton.click();
        });

        await test.step('3.4.User can quickly move the time', async () => {
          await timePickerButton.click();

          await dashboardPage
            .getByGrafanaSelector(selectors.components.TimePicker.fromField)
            .fill('2024-01-01 08:30:00');
          await dashboardPage.getByGrafanaSelector(selectors.components.TimePicker.toField).fill('2024-01-01 08:40:00');
          await dashboardPage.getByGrafanaSelector(selectors.components.TimePicker.applyTimeRange).click();

          expect.soft(await timePickerButton.textContent()).toContain('2024-01-01 08:30:00 to 2024-01-01 08:40:00');

          const forwardBtn = page.locator('button[aria-label="Move time range forwards"]');
          const backwardBtn = page.locator('button[aria-label="Move time range backwards"]');

          await forwardBtn.click();

          expect.soft(await timePickerButton.textContent()).toContain('2024-01-01 08:35:00 to 2024-01-01 08:45:00');

          await backwardBtn.click();
          await backwardBtn.click();

          expect.soft(await timePickerButton.textContent()).toContain('2024-01-01 08:25:00 to 2024-01-01 08:35:00');
        });
      });

      await test.step('4.Force refresh', async () => {
        const dashboardPage = await gotoDashboardPage({ uid: DASHBOARD });

        const refreshBtn = dashboardPage.getByGrafanaSelector(selectors.components.RefreshPicker.runButtonV2);

        const panelContent = dashboardPage.getByGrafanaSelector(selectors.components.Panels.Panel.content).nth(1);

        const panelContents = await panelContent.textContent();

        await refreshBtn.click();

        expect(await panelContent.textContent()).not.toBe(panelContents);
      });

      await test.step('4.Force refresh', async () => {
        const dashboardPage = await gotoDashboardPage({ uid: DASHBOARD });

        const intervalRefreshBtn = dashboardPage.getByGrafanaSelector(
          selectors.components.RefreshPicker.intervalButtonV2
        );
        await intervalRefreshBtn.click();
        const btn = page.locator('button[aria-label="5 seconds"]');
        await btn.click();

        const panelContent = dashboardPage.getByGrafanaSelector(selectors.components.Panels.Panel.content).nth(1);
        const initialPanelContents = await panelContent.textContent();

        await page.waitForTimeout(5100);

        const refreshedPanelContents = await panelContent.textContent();

        expect(initialPanelContents).not.toBe(refreshedPanelContents);

        await intervalRefreshBtn.click();
        const offBtn = page.locator('button[aria-label="Turn off auto refresh"]');
        await offBtn.click();

        await page.waitForTimeout(5100);

        expect(await panelContent.textContent()).toBe(refreshedPanelContents);
      });
    });
  }
);
