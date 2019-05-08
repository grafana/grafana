import { Page } from 'puppeteer-core';

import { constants } from './constants';
import { loginPage } from 'e2e-test/pages/start/loginPage';

export const login = async (page: Page) => {
  await loginPage.init(page);
  await loginPage.navigateTo();

  await loginPage.pageObjects.username.enter('admin');
  await loginPage.pageObjects.password.enter('admin');
  await loginPage.pageObjects.submit.click();
  await loginPage.waitForResponse();
};

export const ensureLoggedIn = async (page: Page) => {
  await page.goto(`${constants.baseUrl}`);
  if (page.url().indexOf('login') > -1) {
    console.log('Redirected to login page. Logging in...');
    await login(page);
  }
};
