import { launchBrowser } from '../core/launcher';
import { Browser } from 'puppeteer-core';
import { config } from 'e2e-test/core/config';

describe('E2E dummy test', () => {
  let browser: Browser = null;
  beforeAll(async () => {
    browser = await launchBrowser();
  });

  afterAll(async () => {
    if (browser) {
      await browser.close();
    }
  });

  it('Page title should be Grafana', async () => {
    const page = await browser.newPage();
    const response = await page.goto(config.baseUrl);
    const title = await page.title();
    expect(response.ok()).toBe(true);
    expect(title).toBe('Grafana');
  });
});
