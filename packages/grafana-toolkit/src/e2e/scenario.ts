import { Browser, Page } from 'puppeteer-core';
import { launchBrowser } from './launcher';

export const e2eScenario = (
  title: string,
  testDescription: string,
  callback: (browser: Browser, page: Page) => void
) => {
  describe(title, () => {
    let browser: Browser;
    let page: Page;

    beforeAll(async () => {
      browser = await launchBrowser();
      page = await browser.newPage();
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
