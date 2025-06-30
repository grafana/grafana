import { test, expect } from '@grafana/plugin-e2e';

const DASHBOARD_UID = '5SdHCasdf';

test.describe(
  'Dashboard timepicker',
  {
    tag: ['@dashboards'],
  },
  () => {
    test.afterEach(async ({ request }) => {
      // Reset user preferences after each test
      await request.put('/api/user/preferences', {
        data: {
          timezone: '',
        },
      });
    });

    test('Shows the correct calendar days with custom timezone set via preferences', async ({
      page,
      gotoDashboardPage,
      dashboardPage,
      selectors,
      request,
    }) => {
      // Set user preferences for timezone
      const preferencesResponse = await request.put('/api/user/preferences', {
        data: {
          timezone: 'Asia/Tokyo',
        },
      });
      expect(preferencesResponse.status()).toBe(200);

      // Open dashboard with time range from 8th to end of 10th.
      // Will be Tokyo time because of above preference
      await gotoDashboardPage({
        uid: DASHBOARD_UID,
        queryParams: new URLSearchParams({
          timezone: 'Default',
        }),
      });
      await dashboardPage.getByGrafanaSelector(selectors.components.TimePicker.openButton).click();
      await dashboardPage.getByGrafanaSelector(selectors.components.TimePicker.fromField).fill('2022-06-08 00:00:00');
      await dashboardPage.getByGrafanaSelector(selectors.components.TimePicker.toField).fill('2022-06-10 23:59:59');
      await dashboardPage.getByGrafanaSelector(selectors.components.TimePicker.calendar.openButton).first().click();

      // Assert that the calendar shows 08 and 09 and 10 as selected days
      const activeTiles = page.locator('.react-calendar__tile--active, .react-calendar__tile--hasActive');
      await expect(activeTiles).toHaveCount(3);
    });

    test('Shows the correct calendar days with custom timezone set via time picker', async ({
      page,
      gotoDashboardPage,
      dashboardPage,
      selectors,
    }) => {
      // Open dashboard with time range from 2022-06-08 00:00:00 to 2022-06-10 23:59:59 in Tokyo time
      await gotoDashboardPage({
        uid: DASHBOARD_UID,
        queryParams: new URLSearchParams({
          timezone: 'Asia/Tokyo',
        }),
      });

      // Open dashboard with time range from 8th to end of 10th.
      await dashboardPage.getByGrafanaSelector(selectors.components.TimePicker.openButton).click();
      await dashboardPage.getByGrafanaSelector(selectors.components.TimePicker.fromField).fill('2022-06-08 00:00:00');
      await dashboardPage.getByGrafanaSelector(selectors.components.TimePicker.toField).fill('2022-06-10 23:59:59');
      await dashboardPage.getByGrafanaSelector(selectors.components.TimePicker.calendar.openButton).first().click();

      // Assert that the calendar shows 08 and 09 and 10 as selected days
      const activeTiles = page.locator('.react-calendar__tile--active, .react-calendar__tile--hasActive');
      await expect(activeTiles).toHaveCount(3);
    });
  }
);
