import { test, expect } from '@grafana/plugin-e2e';

test.describe('Login', { tag: ['@acceptance', '@login'] }, () => {
  test('a11y', { tag: ['@a11y'] }, async ({ selectors, page, scanForA11yViolations }) => {
    await page.goto(selectors.pages.Login.url);
    await expect(page.getByTestId(selectors.pages.Login.username)).toBeVisible();
    const results = await scanForA11yViolations();
    expect(results).toHaveNoA11yViolations({ ignoredRules: ['color-contrast'] });
  });

  test(
    'a11y - password change prompt',
    { tag: ['@a11y'] },
    async ({ selectors, page, grafanaAPICredentials, scanForA11yViolations }) => {
      await page.goto(selectors.pages.Login.url);

      await page.getByTestId(selectors.pages.Login.username).fill(grafanaAPICredentials.user);
      await page.getByTestId(selectors.pages.Login.password).fill(grafanaAPICredentials.password);

      await page.getByTestId(selectors.pages.Login.submit).click();
      await expect(page.getByTestId(selectors.pages.Login.skip)).toBeVisible();

      const results = await scanForA11yViolations();
      expect(results).toHaveNoA11yViolations({ ignoredRules: ['color-contrast'] });
    }
  );

  test('Can login successfully', async ({ selectors, page, grafanaAPICredentials }) => {
    test.skip(grafanaAPICredentials.password === 'admin', 'Does not run with default password');

    await page.goto(selectors.pages.Login.url);

    await page.getByTestId(selectors.pages.Login.username).fill(grafanaAPICredentials.user);
    await page.getByTestId(selectors.pages.Login.password).fill(grafanaAPICredentials.password);

    await page.getByTestId(selectors.pages.Login.submit).click();

    await expect(page.getByTestId(selectors.components.NavToolbar.commandPaletteTrigger)).toBeVisible();
  });

  test('Can login successfully and skip password change', async ({ selectors, page, grafanaAPICredentials }) => {
    test.skip(grafanaAPICredentials.password !== 'admin', 'Only runs with the default password');

    await page.goto(selectors.pages.Login.url);

    await page.getByTestId(selectors.pages.Login.username).fill(grafanaAPICredentials.user);
    await page.getByTestId(selectors.pages.Login.password).fill(grafanaAPICredentials.password);

    await page.getByTestId(selectors.pages.Login.submit).click();
    await page.getByTestId(selectors.pages.Login.skip).click();

    await expect(page.getByTestId(selectors.components.NavToolbar.commandPaletteTrigger)).toBeVisible();
  });
});
