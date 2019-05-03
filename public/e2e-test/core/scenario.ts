import { Browser } from 'puppeteer-core';
import { launchBrowser } from './launcher';

export const e2eScenario = (title: string, testDescription: string, callback: (browser: Browser) => void) => {
  describe(title, () => {
    let browser: Browser = null;

    beforeAll(async () => {
      browser = await launchBrowser();
    });

    afterAll(async () => {
      if (browser) {
        await browser.close();
      }
    });

    it(testDescription, async () => {
      await callback(browser);
    });
  });
};
