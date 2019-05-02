import { launchBrowser } from '../core/launcher';
import { Browser } from 'puppeteer-core';

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
    const response = await page.goto('http://localhost:3333');
    const title = await page.title();
    await expect(response.ok()).toBe(true);
    await expect(title).toBe('Grafana');
  });
});
