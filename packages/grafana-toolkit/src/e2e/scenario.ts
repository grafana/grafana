import { Browser, Page } from 'puppeteer-core';
import { launchBrowser } from './launcher';
import { ensureLoggedIn } from './login';

export interface ScenarioArguments {
  describeName: string;
  itName: string;
  scenario: (browser: Browser, page: Page) => void;
  skipScenario?: boolean;
}

export const e2eScenario = ({ describeName, itName, scenario, skipScenario = false }: ScenarioArguments) => {
  describe(describeName, () => {
    if (skipScenario) {
      it.skip(itName, async () => {
        expect(false).toBe(true);
      });
      return;
    }

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
  });
};
