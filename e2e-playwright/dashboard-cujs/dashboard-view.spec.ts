import { test, expect } from '@grafana/plugin-e2e';

import { getConfigDashboards } from './utils';

test.use({
  featureToggles: {
    scopeFilters: true,
    groupByVariable: true,
    reloadDashboardsOnParamsChange: true,
  },
});

const DASHBOARD_UNDER_TEST = 'cuj-dashboard-1';
const PANEL_UNDER_TEST = 'Panel Title';

test.describe(
  'Dashboard view CUJs',
  {
    tag: ['@dashboard-cujs'],
  },
  () => {
    test('View a dashboard', async ({ page, gotoDashboardPage, selectors }) => {
      const dashboards = await getConfigDashboards();
      if (dashboards.length === 0) {
        dashboards.push(DASHBOARD_UNDER_TEST);
      }

      for (const db of dashboards) {
        await test.step('1.Loads dashboard successfully - ' + db, async () => {
          const dashboardPage = await gotoDashboardPage({ uid: db });

          const panelTitle = dashboardPage.getByGrafanaSelector(
            selectors.components.Panels.Panel.title(PANEL_UNDER_TEST)
          );
          await expect(panelTitle).toBeVisible();
        });
      }

      await test.step('2.Top level selectors', async () => {
        const dashboardPage = await gotoDashboardPage({ uid: DASHBOARD_UNDER_TEST });

        const groupByVariable = dashboardPage.getByGrafanaSelector(
          selectors.pages.Dashboard.SubMenu.submenuItemLabels('groupBy')
        );

        const adHocVariable = dashboardPage.getByGrafanaSelector(
          selectors.pages.Dashboard.SubMenu.submenuItemLabels('adHoc')
        );

        expect(groupByVariable).toBeVisible();
        expect(adHocVariable).toBeVisible();
      });

      await test.step('3.View individual panel', async () => {
        const dashboardPage = await gotoDashboardPage({ uid: DASHBOARD_UNDER_TEST });

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

      await test.step('4.Set time range for the dashboard', async () => {
        const dashboardPage = await gotoDashboardPage({ uid: DASHBOARD_UNDER_TEST });

        const timePickerButton = dashboardPage.getByGrafanaSelector(selectors.components.TimePicker.openButton);

        await test.step('4.1.Click on Quick range', async () => {
          await page.mouse.move(0, 0);
          await expect.soft(timePickerButton).toContainText('Last 6 hours');
          await timePickerButton.click();

          const label = page.getByText('Last 5 minutes');
          await label.click();

          expect.soft(await timePickerButton.textContent()).toContain('Last 5 minutes');
        });

        await test.step('4.2.Set absolute time range', async () => {
          await timePickerButton.click();
          await dashboardPage
            .getByGrafanaSelector(selectors.components.TimePicker.fromField)
            .fill('2024-01-01 00:00:00');
          await dashboardPage.getByGrafanaSelector(selectors.components.TimePicker.toField).fill('2024-01-01 23:59:59');
          await dashboardPage.getByGrafanaSelector(selectors.components.TimePicker.applyTimeRange).click();

          expect.soft(await timePickerButton.textContent()).toContain('2024-01-01 00:00:00 to 2024-01-01 23:59:59');
        });

        await test.step('4.3.Change time zone', async () => {
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

        await test.step('4.4.Navigate time range', async () => {
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

      await test.step('5.Force refresh', async () => {
        const dashboardPage = await gotoDashboardPage({ uid: DASHBOARD_UNDER_TEST });

        const refreshBtn = dashboardPage.getByGrafanaSelector(selectors.components.RefreshPicker.runButtonV2);

        const panelContent = dashboardPage.getByGrafanaSelector(selectors.components.Panels.Panel.content).nth(1);

        const panelContents = await panelContent.textContent();

        await refreshBtn.click();

        await page.waitForLoadState('networkidle');

        expect(await panelContent.textContent()).not.toBe(panelContents);
      });

      await test.step('6.Turn off refresh', async () => {
        const dashboardPage = await gotoDashboardPage({ uid: DASHBOARD_UNDER_TEST });

        const intervalRefreshBtn = dashboardPage.getByGrafanaSelector(
          selectors.components.RefreshPicker.intervalButtonV2
        );
        await intervalRefreshBtn.click();
        const btn = page.locator('button[aria-label="5 seconds"]');
        await btn.click();

        const panelContent = dashboardPage.getByGrafanaSelector(selectors.components.Panels.Panel.content).nth(1);
        const initialPanelContents = await panelContent.textContent();

        await expect(panelContent).not.toHaveText(initialPanelContents!, {
          timeout: 7000,
        });

        const refreshedPanelContents = await panelContent.textContent();

        await intervalRefreshBtn.click();
        const offBtn = page.locator('button[aria-label="Turn off auto refresh"]');
        await offBtn.click();

        await expect(panelContent).toHaveText(refreshedPanelContents!, {
          timeout: 7000,
        });
      });
    });
  }
);
