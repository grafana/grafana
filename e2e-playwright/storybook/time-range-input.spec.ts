import { test, expect } from '@playwright/test';

import { selectors } from '@grafana/e2e-selectors';

test('keeps the time range menu and calendar fully visible in a laptop-sized drawer', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/iframe.html?id=date-time-pickers-timerangeinput--inside-drawer&viewMode=story');
  await page.getByRole('button', { name: 'Open drawer', exact: true }).click();
  await page.getByTestId(selectors.components.TimePicker.openButton).click();

  await expect(page.locator('#TimePickerContent')).toBeInViewport({ ratio: 1 });

  await page.getByRole('button', { name: 'Open calendar', exact: true }).first().click();

  await expect(page.getByTestId(selectors.components.TimePicker.calendar.label)).toBeInViewport({ ratio: 1 });
});
