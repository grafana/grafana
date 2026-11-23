import { test, expect, DEFAULT_A11Y_TAGS } from '@grafana/plugin-e2e';

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
  featureToggles: {
    dashboardNewLayouts: true,
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
      await page.keyboard.type('Tokyo');
      await page.getByRole('option', { name: 'Tokyo' }).click();
      await page.getByTestId(selectors.components.UserProfile.preferencesSaveButton).click();
      // wait for the page to reload before trying to navigate, otherwise this can cause flakes
      // see e.g. https://github.com/microsoft/playwright/issues/21451#issuecomment-1502251404
      await expect(page.getByTestId(selectors.components.UserProfile.preferencesSaveButton)).not.toBeDisabled();
      await page.waitForURL((url) => new URL(url).pathname === '/profile');
      await page.waitForLoadState('networkidle');
      await expect(page.getByTestId(selectors.components.TimeZonePicker.containerV2)).toContainText('Tokyo');

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

test(
  'Dashboard time picker remains accessible through range selection',
  { tag: ['@a11y', '@dashboards'] },
  async ({ createUser, page, gotoDashboardPage, dashboardPage, selectors, scanForA11yViolations }) => {
    await createUser();
    await page.getByTestId(selectors.pages.Login.username).fill(USER);
    await page.getByTestId(selectors.pages.Login.password).fill(PASSWORD);
    await page.getByTestId(selectors.pages.Login.submit).click();
    await expect(page.getByTestId(selectors.components.NavToolbar.commandPaletteTrigger)).toBeVisible();
    await gotoDashboardPage({ uid: 'O6f11TZWk' });
    await page.addStyleTag({ content: '*, *::before, *::after { transition: none !important; }' });

    const trigger = dashboardPage.getByGrafanaSelector(selectors.components.TimePicker.openButton);
    const picker = page.getByRole('dialog', { name: 'Time range picker', exact: true });
    const scanPicker = async () => {
      await expect(picker).toBeVisible();
      const results = await scanForA11yViolations({
        include: `[data-testid="${selectors.components.TimePicker.overlayContent}"]`,
        // The presentation-role-conflict rule is a best practice, outside the default WCAG tags.
        options: { runOnly: { type: 'tag', values: [...DEFAULT_A11Y_TAGS, 'best-practice'] } },
      });
      expect.soft(results).toHaveNoA11yViolations();
    };

    await test.step('Open the picker and scan its controls', async () => {
      await trigger.click();
      await expect(picker.getByPlaceholder('Search quick ranges')).toBeVisible();
      await scanPicker();
    });

    await test.step('Filter quick ranges and navigate with the keyboard', async () => {
      await picker.getByPlaceholder('Search quick ranges').fill('minutes');
      const option = picker.getByRole('checkbox', { name: 'Last 5 minutes', exact: true });
      await picker.getByPlaceholder('Search quick ranges').press('Tab');
      await expect(picker.getByRole('button', { name: 'Clear', exact: true })).toBeFocused();
      await page.keyboard.press('Tab');
      await expect(option).toBeFocused();
      await option.press('ArrowDown');
      const nextOption = picker.getByRole('checkbox', { name: 'Last 15 minutes', exact: true });
      await expect(nextOption).toBeFocused();
      await scanPicker();
      await nextOption.press('Enter');
      await expect(trigger).toContainText('Last 15 minutes');
      await expect(picker).toBeHidden();
    });

    await test.step('Reopen with the selected relative range', async () => {
      await trigger.click();
      await expect(picker.getByRole('checkbox', { name: 'Last 15 minutes', exact: true })).toBeChecked();
      await scanPicker();
    });

    await test.step('Apply an absolute range and scan its history', async () => {
      await dashboardPage.getByGrafanaSelector(selectors.components.TimePicker.fromField).fill('2022-06-08 00:00:00');
      await dashboardPage.getByGrafanaSelector(selectors.components.TimePicker.toField).fill('2022-06-10 23:59:59');
      await scanPicker();
      await dashboardPage.getByGrafanaSelector(selectors.components.TimePicker.applyTimeRange).click();
      await expect(picker).toBeHidden();
      await trigger.click();
      await expect(picker.getByText('Recently used absolute ranges')).toBeVisible();
      await scanPicker();
      await page.keyboard.press('Escape');
      await expect(picker).toBeHidden();
      await expect(trigger).toBeFocused();
    });
  }
);
