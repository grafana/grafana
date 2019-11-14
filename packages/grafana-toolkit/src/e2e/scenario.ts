import { Browser, Page } from 'puppeteer-core';
import { launchBrowser } from './launcher';
import { ensureLoggedIn } from './login';

export interface ScenarioArguments {
  describeName: string;
  itName: string;
  scenario: (browser: Browser, page: Page) => void;
  runScenario?: boolean;
}

export const e2eScenario = ({ describeName, itName, scenario, runScenario = true }: ScenarioArguments) => {
  describe(describeName, () => {
    if (runScenario) {
      let browser: Browser;
      let page: Page;

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

      it(itName, async () => {
        await scenario(browser, page);
      });
    } else {
      it.skip(itName, async () => {
        expect(false).toBe(true);
      });
    }
  });
};
