import { test, expect } from '@grafana/plugin-e2e';

const DASHBOARD_UID = 'timeseries-thresholds-no-data';

test.use({
  openFeature: {
    flags: {
      'timeseries.thresholdsWithoutData': true,
    },
  },
});

test.describe('Panels test: TimeSeries thresholds without data', { tag: ['@panels', '@timeseries'] }, () => {
  test.beforeEach(async ({ gotoDashboardPage }) => {
    await gotoDashboardPage({ uid: DASHBOARD_UID });
  });

  for (const title of ['No frames', 'Only nulls']) {
    test(`draws thresholds and keeps the no data message: ${title}`, async ({ page, selectors }) => {
      const panel = page.getByTestId(selectors.components.Panels.Panel.title(title));

      await expect(panel.locator('.u-over'), 'a plot is drawn').toBeVisible();
      await expect(panel.getByText('No data'), 'the no data message stays visible').toBeVisible();
    });
  }

  test('keeps the no data view when the thresholds style is off', async ({ page, selectors }) => {
    const panel = page.getByTestId(selectors.components.Panels.Panel.title('Thresholds off'));

    await expect(panel.getByText('No data')).toBeVisible();
    await expect(panel.locator('.uplot'), 'no plot is drawn').toHaveCount(0);
  });
});
