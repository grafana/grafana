import { test, expect } from '@grafana/plugin-e2e';

import { runA11yAudit } from '../utils/axe-a11y';

test('Is accessible', { tag: ['@acceptance', '@a11y'] }, async ({ selectors, page }) => {
  await page.goto(selectors.pages.Login.url);
  await expect(page.getByTestId(selectors.pages.Login.username)).toBeVisible();
  await runA11yAudit(page, 1); // there are several contrast color issues.
});

test(
  'Is accessible on password change prompt',
  { tag: ['@acceptance', '@a11y'] },
  async ({ selectors, page, grafanaAPICredentials }) => {
    await page.goto(selectors.pages.Login.url);

    await page.getByTestId(selectors.pages.Login.username).fill(grafanaAPICredentials.user);
    await page.getByTestId(selectors.pages.Login.password).fill(grafanaAPICredentials.password);

    await page.getByTestId(selectors.pages.Login.submit).click();
    await expect(page.getByTestId(selectors.pages.Login.skip)).toBeVisible();

    await runA11yAudit(page);
  }
);

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
