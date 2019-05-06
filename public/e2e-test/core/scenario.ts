import { Browser, Page } from 'puppeteer-core';
import { launchBrowser } from './launcher';
import { ensureLoggedIn } from './login';

export const e2eScenario = (
  title: string,
  testDescription: string,
  callback: (browser: Browser, page: Page) => void
) => {
  describe(title, () => {
    let browser: Browser = null;
    let page: Page = null;

    beforeAll(async () => {
      browser = await launchBrowser();
      page = await browser.newPage();
      await ensureLoggedIn(page);
    });

    afterAll(async () => {
      if (browser) {
        await browser.close();
      }
    });

    it(testDescription, async () => {
      await callback(browser, page);
    });
  });
};
