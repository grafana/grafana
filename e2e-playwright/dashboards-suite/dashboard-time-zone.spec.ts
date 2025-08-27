import { addDays, addHours, differenceInCalendarDays, differenceInMinutes, isBefore, parseISO, toDate } from 'date-fns';
import { Page } from 'playwright-core';

import { test, expect, DashboardPage, E2ESelectorGroups } from '@grafana/plugin-e2e';

const TIMEZONE_DASHBOARD_UID = 'd41dbaa2-a39e-4536-ab2b-caca52f1a9c8';

test.use({
  featureToggles: {
    kubernetesDashboards: process.env.KUBERNETES_DASHBOARDS === 'true',
  },
});

test.describe(
  'Dashboard time zone support',
  {
    tag: ['@dashboards'],
  },
  () => {
    test.fixme('Tests dashboard time zone scenarios', async ({ page, gotoDashboardPage, selectors }) => {
      const dashboardPage = await gotoDashboardPage({ uid: TIMEZONE_DASHBOARD_UID });

      const fromTimeZone = 'UTC';
      const toTimeZone = 'America/Chicago';
      const offset = offsetBetweenTimeZones(toTimeZone, fromTimeZone);

      // Enter edit mode
      await dashboardPage.getByGrafanaSelector(selectors.components.NavToolbar.editDashboard.editButton).click();

      // Open dashboard settings
      await dashboardPage.getByGrafanaSelector(selectors.components.NavToolbar.editDashboard.settingsButton).click();

      // Change timezone to UTC
      await page.getByTestId(selectors.components.TimeZonePicker.containerV2).click();
      await page.getByRole('option', { name: 'Coordinated Universal Time ' }).click();

      // Close settings and refresh
      await dashboardPage
        .getByGrafanaSelector(selectors.components.NavToolbar.editDashboard.backToDashboardButton)
        .click();
      await dashboardPage.getByGrafanaSelector(selectors.components.RefreshPicker.runButtonV2).click();

      const panelsToCheck = ['Panel in timezone'];

      const timesInUtc: Record<string, string> = {};

      // Verify all panels are visible
      for (const title of panelsToCheck) {
        await expect(dashboardPage.getByGrafanaSelector(selectors.components.Panels.Panel.title(title))).toBeVisible();
        const timeCell = dashboardPage
          .getByGrafanaSelector(selectors.components.Panels.Panel.title(title))
          .getByRole('row')
          .nth(1)
          .getByRole('gridcell')
          .first();
        const time = await timeCell.textContent();
        if (time) {
          timesInUtc[title] = time;
        }
      }

      // Open dashboard settings
      await dashboardPage.getByGrafanaSelector(selectors.components.NavToolbar.editDashboard.settingsButton).click();

      // Change timezone to America/Chicago
      await page.getByTestId(selectors.components.TimeZonePicker.containerV2).click();
      await page.getByRole('option', { name: toTimeZone }).click();

      // Close settings and refresh
      await dashboardPage
        .getByGrafanaSelector(selectors.components.NavToolbar.editDashboard.backToDashboardButton)
        .click();
      await dashboardPage.getByGrafanaSelector(selectors.components.RefreshPicker.runButtonV2).click();

      // Verify panels are still visible after timezone change
      for (const title of panelsToCheck) {
        await expect(dashboardPage.getByGrafanaSelector(selectors.components.Panels.Panel.title(title))).toBeVisible();
        const timeCell = dashboardPage
          .getByGrafanaSelector(selectors.components.Panels.Panel.title(title))
          .getByRole('row')
          .nth(1)
          .getByRole('gridcell')
          .first();
        await expect(async () => {
          const inUtc = timesInUtc[title];
          const inTz = await timeCell.textContent();
          expect(inTz).not.toBeNull();
          if (inTz) {
            const isCorrect = isTimeCorrect(inUtc, inTz, offset);
            expect(isCorrect).toEqual(true);
          }
        }).toPass();
      }
    });

    test('Tests relative timezone support and overrides', async ({ page, gotoDashboardPage, selectors }) => {
      // Open dashboard
      const dashboardPage = await gotoDashboardPage({
        uid: TIMEZONE_DASHBOARD_UID,
      });

      // Switch to Browser timezone
      await setTimeRange(page, dashboardPage, selectors, {
        from: 'now-6h',
        to: 'now',
        zone: 'Browser',
      });

      await expect(
        dashboardPage
          .getByGrafanaSelector(selectors.components.Panels.Panel.title('Panel with relative time override'))
          .locator('[role="row"]')
          .filter({ hasText: '00:00:00' })
      ).toBeVisible();

      // Today so far, still in Browser timezone
      await setTimeRange(page, dashboardPage, selectors, {
        from: 'now/d',
        to: 'now',
      });

      await expect(
        dashboardPage
          .getByGrafanaSelector(selectors.components.Panels.Panel.title('Panel with relative time override'))
          .locator('[role="row"]')
          .filter({ hasText: '00:00:00' })
      ).toBeVisible();

      await expect(
        dashboardPage
          .getByGrafanaSelector(selectors.components.Panels.Panel.title('Panel in timezone'))
          .locator('[role="row"]')
          .filter({ hasText: '00:00:00' })
      ).toBeVisible();

      // Test UTC timezone
      await setTimeRange(page, dashboardPage, selectors, {
        from: 'now-6h',
        to: 'now',
        zone: 'Coordinated Universal Time',
      });

      await expect(
        dashboardPage
          .getByGrafanaSelector(selectors.components.Panels.Panel.title('Panel with relative time override'))
          .locator('[role="row"]')
          .filter({ hasText: '00:00:00' })
      ).toBeVisible();

      // Today so far, still in UTC timezone
      await setTimeRange(page, dashboardPage, selectors, {
        from: 'now/d',
        to: 'now',
      });

      await expect(
        dashboardPage
          .getByGrafanaSelector(selectors.components.Panels.Panel.title('Panel with relative time override'))
          .locator('[role="row"]')
          .filter({ hasText: '00:00:00' })
      ).toBeVisible();

      await expect(
        dashboardPage
          .getByGrafanaSelector(selectors.components.Panels.Panel.title('Panel in timezone'))
          .locator('[role="row"]')
          .filter({ hasText: '00:00:00' })
      ).toBeVisible();

      // Test Tokyo timezone
      await setTimeRange(page, dashboardPage, selectors, {
        from: 'now-6h',
        to: 'now',
        zone: 'Asia/Tokyo',
      });

      await expect(
        dashboardPage
          .getByGrafanaSelector(selectors.components.Panels.Panel.title('Panel with relative time override'))
          .locator('[role="row"]')
          .filter({ hasText: '00:00:00' })
      ).toBeVisible();

      // Today so far, still in Tokyo timezone
      await setTimeRange(page, dashboardPage, selectors, {
        from: 'now/d',
        to: 'now',
      });

      await expect(
        dashboardPage
          .getByGrafanaSelector(selectors.components.Panels.Panel.title('Panel with relative time override'))
          .locator('[role="row"]')
          .filter({ hasText: '00:00:00' })
      ).toBeVisible();

      await expect(
        dashboardPage
          .getByGrafanaSelector(selectors.components.Panels.Panel.title('Panel in timezone'))
          .locator('[role="row"]')
          .filter({ hasText: '00:00:00' })
      ).toBeVisible();

      // Test LA timezone
      await setTimeRange(page, dashboardPage, selectors, {
        from: 'now-6h',
        to: 'now',
        zone: 'America/Los Angeles',
      });

      await expect(
        dashboardPage
          .getByGrafanaSelector(selectors.components.Panels.Panel.title('Panel with relative time override'))
          .locator('[role="row"]')
          .filter({ hasText: '00:00:00' })
      ).toBeVisible();

      // Today so far, still in LA timezone
      await setTimeRange(page, dashboardPage, selectors, {
        from: 'now/d',
        to: 'now',
      });

      await expect(
        dashboardPage
          .getByGrafanaSelector(selectors.components.Panels.Panel.title('Panel with relative time override'))
          .locator('[role="row"]')
          .filter({ hasText: '00:00:00' })
      ).toBeVisible();

      await expect(
        dashboardPage
          .getByGrafanaSelector(selectors.components.Panels.Panel.title('Panel in timezone'))
          .locator('[role="row"]')
          .filter({ hasText: '00:00:00' })
      ).toBeVisible();
    });
  }
);

// Helper function to set time range with optional timezone
async function setTimeRange(
  page: Page,
  dashboardPage: DashboardPage,
  selectors: E2ESelectorGroups,
  options: { from: string; to: string; zone?: string }
) {
  await dashboardPage.getByGrafanaSelector(selectors.components.TimePicker.openButton).click();

  await dashboardPage.getByGrafanaSelector(selectors.components.TimePicker.fromField).fill(options.from);
  await dashboardPage.getByGrafanaSelector(selectors.components.TimePicker.toField).fill(options.to);

  if (options.zone) {
    await page.getByRole('button', { name: 'Change time settings' }).click();
    await page.getByTestId(selectors.components.TimeZonePicker.containerV2).click();
    await page.getByRole('option', { name: options.zone }).click();
  }

  await dashboardPage.getByGrafanaSelector(selectors.components.TimePicker.applyTimeRange).click();
}

const isTimeCorrect = (inUtc: string, inTz: string, offset: number): boolean => {
  if (inUtc === inTz) {
    // we need to catch issues when timezone isn't changed for some reason like https://github.com/grafana/grafana/issues/35504
    return false;
  }

  const utcDate = toDate(parseISO(inUtc));
  const utcDateWithOffset = addHours(toDate(parseISO(inUtc)), offset);
  const dayDifference = differenceInCalendarDays(utcDate, utcDateWithOffset); // if the utcDate +/- offset is the day before/after then we need to adjust reference
  const dayOffset = isBefore(utcDateWithOffset, utcDate) ? dayDifference * -1 : dayDifference;
  const tzDate = addDays(toDate(parseISO(inTz)), dayOffset); // adjust tzDate with any dayOffset
  const diff = Math.abs(differenceInMinutes(utcDate, tzDate)); // use Math.abs if tzDate is in future

  return diff <= Math.abs(offset * 60);
};

const offsetBetweenTimeZones = (timeZone1: string, timeZone2: string, when: Date = new Date()): number => {
  const t1 = convertDateToAnotherTimeZone(when, timeZone1);
  const t2 = convertDateToAnotherTimeZone(when, timeZone2);
  return (t1.getTime() - t2.getTime()) / (1000 * 60 * 60);
};

const convertDateToAnotherTimeZone = (date: Date, timeZone: string): Date => {
  const dateString = date.toLocaleString('en-US', {
    timeZone: timeZone,
  });
  return new Date(dateString);
};
