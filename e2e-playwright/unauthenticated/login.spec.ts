import { test, expect } from '@grafana/plugin-e2e';

test(
  'Can login successfully',
  {
    tag: ['@acceptance'],
  },
  async ({ selectors, page, grafanaAPICredentials }) => {
    await page.goto(selectors.pages.Login.url);

    await page.getByTestId(selectors.pages.Login.username).fill(grafanaAPICredentials.user);
    await page.getByTestId(selectors.pages.Login.password).fill(grafanaAPICredentials.password);

    await page.getByTestId(selectors.pages.Login.submit).click();
    await expect(page.getByTestId(selectors.pages.Login.submit)).toHaveCount(0);

    // Click the skip button, if it is offered, if we know we used the default password
    if (grafanaAPICredentials.password === 'admin') {
      if ((await page.getByTestId(selectors.pages.Login.skip).count()) > 0) {
        await page.getByTestId(selectors.pages.Login.skip).click();
      }
    }

    await expect(page.getByTestId(selectors.components.NavToolbar.commandPaletteTrigger)).toBeVisible();
  }
);
