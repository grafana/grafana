import { test, expect } from '@grafana/plugin-e2e';

test(
  'Can login successfully',
  {
    tag: ['@smoke'],
  },
  async ({ selectors, page }) => {
    await page.goto(selectors.pages.Login.url);

    await page.getByTestId(selectors.pages.Login.username).fill('admin');
    await page.getByTestId(selectors.pages.Login.password).fill('admin');
    await page.getByTestId(selectors.pages.Login.submit).click();

    await page.getByTestId(selectors.pages.Login.skip).click();

    await expect(page.getByTestId(selectors.components.NavToolbar.commandPaletteTrigger)).toBeVisible();
  }
);
