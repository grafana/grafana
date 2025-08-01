import { test, expect } from '@grafana/plugin-e2e';

const DASHBOARD_UID = '5SdHCasdf';

const USER = 'dashboard-timepicker-test';
const PASSWORD = 'dashboard-timepicker-test';

// Separate user to isolate changes from other tests
test.use({
  user: {
    user: USER,
    password: PASSWORD,
  },
  storageState: {
    cookies: [],
    origins: [],
  },
});

test.describe(
  'Dashboard timepicker',
  {
    tag: ['@dashboards'],
  },
  () => {
    test('Shows the correct calendar days with custom timezone set via preferences', async ({
      createUser,
      page,
      gotoDashboardPage,
      dashboardPage,
      selectors,
    }) => {
      await createUser();
      // login manually for now
      await page.getByTestId(selectors.pages.Login.username).fill(USER);
      await page.getByTestId(selectors.pages.Login.password).fill(PASSWORD);
      await page.getByTestId(selectors.pages.Login.submit).click();
      await expect(page.getByTestId(selectors.components.NavToolbar.commandPaletteTrigger)).toBeVisible();

      // Set user preferences for timezone
      await page.goto('/profile');
      await page.getByTestId(selectors.components.TimeZonePicker.containerV2).click();
      await page.getByRole('option', { name: 'Asia/Tokyo' }).click();
      await page.getByTestId(selectors.components.UserProfile.preferencesSaveButton).click();
      // wait for the page to reload before trying to navigate, otherwise this can cause flakes
      // see e.g. https://github.com/microsoft/playwright/issues/21451#issuecomment-1502251404
      await page.waitForURL('/profile');

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
      createUser,
      page,
      gotoDashboardPage,
      dashboardPage,
      selectors,
    }) => {
      await createUser();
      // login manually for now
      await page.getByTestId(selectors.pages.Login.username).fill(USER);
      await page.getByTestId(selectors.pages.Login.password).fill(PASSWORD);
      await page.getByTestId(selectors.pages.Login.submit).click();
      await expect(page.getByTestId(selectors.components.NavToolbar.commandPaletteTrigger)).toBeVisible();

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
