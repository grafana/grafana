import { test, expect } from '@grafana/plugin-e2e';

test(
  'Can login successfully',
  {
    tag: ['@acceptance'],
  },
  async ({ selectors, page, grafanaAPICredentials }) => {
    test.skip(grafanaAPICredentials.password === 'admin', 'Does not run with default password');

    console.log('unauthed login test: Initial cookies', { date: new Date().toISOString() });
    console.log(
      (await page.context().cookies()).map((v) => `${v.name}=${v.value.substring(0, 50)} (${v.domain})`).join(';\n\t')
    );

    await page.goto(selectors.pages.Login.url);

    await page.getByTestId(selectors.pages.Login.username).fill(grafanaAPICredentials.user);
    await page.getByTestId(selectors.pages.Login.password).fill(grafanaAPICredentials.password);

    await page.getByTestId(selectors.pages.Login.submit).click();

    await expect(page.getByTestId(selectors.components.NavToolbar.commandPaletteTrigger)).toBeVisible();

    console.log('unauthed login test: after cookies:');
    console.log(
      (await page.context().cookies()).map((v) => `${v.name}=${v.value.substring(0, 50)} (${v.domain})`).join(';\n\t')
    );

    await page.context().storageState({ path: `playwright/.auth/coreAuth.json` });
  }
);

test(
  'Can login successfully and skip password change',
  {
    tag: ['@acceptance'],
  },
  async ({ selectors, page, grafanaAPICredentials }) => {
    test.skip(grafanaAPICredentials.password !== 'admin', 'Only runs with the default password');

    console.log('unauthed login test: Initial cookies:', { date: new Date().toISOString() });
    console.log(
      (await page.context().cookies()).map((v) => `${v.name}=${v.value.substring(0, 50)} (${v.domain})`).join(';\n\t')
    );

    await page.goto(selectors.pages.Login.url);

    await page.getByTestId(selectors.pages.Login.username).fill(grafanaAPICredentials.user);
    await page.getByTestId(selectors.pages.Login.password).fill(grafanaAPICredentials.password);

    await page.getByTestId(selectors.pages.Login.submit).click();
    await page.getByTestId(selectors.pages.Login.skip).click();

    await expect(page.getByTestId(selectors.components.NavToolbar.commandPaletteTrigger)).toBeVisible();

    console.log('unauthed login test: after cookies:');
    console.log(
      (await page.context().cookies()).map((v) => `${v.name}=${v.value.substring(0, 50)} (${v.domain})`).join(';\n\t')
    );

    await page.context().storageState({ path: `playwright/.auth/coreAuth.json` });
  }
);
