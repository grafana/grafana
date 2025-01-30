import { test, expect } from '@playwright/test';

const baseURL = `http://${process.env.HOST || 'localhost'}:${process.env.PORT || 3000}`;

test('BarGauge', async ({ page }) => {
  const barGaugeLocation = 'd/O6f11TZWk/panel-tests-bar-gauge?orgId=1&from=now-6h&to=now&timezone=Europe%2FLondon';
  await page.goto(`${baseURL}/${barGaugeLocation}`);

  await expect(page).toHaveScreenshot('bargauge.png', { fullPage: true, animations: 'disabled' });
});
