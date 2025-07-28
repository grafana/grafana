import { test, expect } from '@grafana/plugin-e2e';

test(
  'Can login successfully',
  {
    tag: ['@acceptance'],
  },
  async ({ selectors, page, grafanaAPICredentials }) => {
    test.skip(grafanaAPICredentials.password === 'admin', 'Does not run with default password');

    await page.goto(selectors.pages.Login.url);

    await page.getByTestId(selectors.pages.Login.username).fill(grafanaAPICredentials.user);
    await page.getByTestId(selectors.pages.Login.password).fill(grafanaAPICredentials.password);

    await page.getByTestId(selectors.pages.Login.submit).click();

    await expect(page.getByTestId(selectors.components.NavToolbar.commandPaletteTrigger)).toBeVisible();
  }
);

test(
  'Can login successfully and skip password change',
  {
    tag: ['@acceptance'],
  },
  async ({ selectors, page, grafanaAPICredentials }) => {
    test.skip(grafanaAPICredentials.password !== 'admin', 'Only runs with the default password');

    await page.goto(selectors.pages.Login.url);

    await page.getByTestId(selectors.pages.Login.username).fill(grafanaAPICredentials.user);
    await page.getByTestId(selectors.pages.Login.password).fill(grafanaAPICredentials.password);

    await page.getByTestId(selectors.pages.Login.submit).click();
    await page.getByTestId(selectors.pages.Login.skip).click();

    await expect(page.getByTestId(selectors.components.NavToolbar.commandPaletteTrigger)).toBeVisible();
  }
);
